import { Brackets } from 'typeorm';
import define from '../../define.js';
import { fetchMeta } from '@/misc/fetch-meta.js';
import { Notes } from '@/models/index.js';
import { Note } from '@/models/entities/note.js';
import { safeForSql } from '@/misc/safe-for-sql.js';
import { normalizeForSearch } from '@/misc/normalize-for-search.js';
import { EnhancedTrendingService } from '@/services/enhanced-trending-service.js';

/*
トレンドに載るためには「『直近a分間のユニーク投稿数が今からa分前～今からb分前の間のユニーク投稿数のn倍以上』のハッシュタグの上位5位以内に入る」ことが必要
ユニーク投稿数とはそのハッシュタグと投稿ユーザーのペアのカウントで、例えば同じユーザーが複数回同じハッシュタグを投稿してもそのハッシュタグのユニーク投稿数は1とカウントされる

..が理想だけどPostgreSQLでどうするのか分からないので単に「直近Aの内に投稿されたユニーク投稿数が多いハッシュタグ」で妥協する
*/

const rangeA = 1000 * 60 * 60; // 60分
//const rangeB = 1000 * 60 * 120; // 2時間
//const coefficient = 1.25; // 「n倍」の部分
//const requiredUsers = 3; // 最低何人がそのタグを投稿している必要があるか

const max = 5;

export const meta = {
	tags: ['hashtags'],

	requireCredential: false,
	requireCredentialPrivateMode: true,

	res: {
		type: 'array',
		optional: false, nullable: false,
		items: {
			type: 'object',
			optional: false, nullable: false,
			properties: {
				tag: {
					type: 'string',
					optional: false, nullable: false,
				},
				chart: {
					type: 'array',
					optional: false, nullable: false,
					items: {
						type: 'number',
						optional: false, nullable: false,
					},
				},
				usersCount: {
					type: 'number',
					optional: false, nullable: false,
				},
			},
		},
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		timeframe: {
			type: 'string',
			enum: ['1h', '6h', '24h', '7d'],
			default: '24h',
			description: 'Timeframe for trending calculation'
		},
		includeTypes: {
			type: 'array',
			items: {
				type: 'string',
				enum: ['hashtag', 'topic', 'content']
			},
			default: ['hashtag', 'topic', 'content'],
			description: 'Types of trending items to include'
		},
		limit: {
			type: 'integer',
			minimum: 1,
			maximum: 50,
			default: 10,
			description: 'Maximum number of trending items to return'
		}
	},
	required: [],
} as const;

export default define(meta, paramDef, async (ps) => {
	try {
		// Use enhanced trending service for better results
		const trendingService = EnhancedTrendingService.getInstance();
		const trendingData = await trendingService.getTrendingData({
			timeframe: ps.timeframe,
			limit: ps.limit,
			includeTypes: ps.includeTypes
		});

		console.log('Enhanced trending service returned:', {
			itemCount: trendingData.items.length,
			hashtagCount: trendingData.items.filter(item => item.type === 'hashtag').length,
			items: trendingData.items.map(item => ({ type: item.type, name: item.name, score: item.trendingScore }))
		});

		// Convert to legacy format for backward compatibility
		const legacyFormat = trendingData.items
			.filter(item => item.type === 'hashtag')
			.map(item => ({
				tag: item.name,
				chart: item.chart,
				usersCount: item.volume,
				// Add enhanced data for clients that can use it
				trendingScore: item.trendingScore,
				engagementVelocity: item.engagementVelocity,
				volumeChange: item.volumeChange,
				isRising: item.metadata.isRising,
				isHot: item.metadata.isHot
			}));

		console.log('Legacy format result:', legacyFormat);

		// If enhanced service fails or returns no hashtags, fallback to original logic
		if (legacyFormat.length === 0) {
			console.log('No hashtags from enhanced service, using fallback');
			return await fallbackTrendingLogic();
		}

		return legacyFormat;
	} catch (error) {
		console.error('Enhanced trending failed, using fallback:', error);
		return await fallbackTrendingLogic();
	}
});

// Fallback to original trending logic
async function fallbackTrendingLogic() {
	const instance = await fetchMeta(true);
	const hiddenTags = instance.hiddenTags.map(t => normalizeForSearch(t));

	const now = new Date();
	now.setMinutes(Math.round(now.getMinutes() / 5) * 5, 0, 0);

	const tagNotes = await Notes.createQueryBuilder('note')
		.where(`note.createdAt > :date`, { date: new Date(now.getTime() - rangeA) })
		.andWhere(new Brackets(qb => {
			qb
				.where(`note.visibility = 'public'`)
			.orWhere(`note.visibility = 'home'`);
		}))
		.andWhere(`note.tags != '{}'`)
		.select(['note.tags', 'note.userId'])
		.cache(60000) // 1 min
		.getMany();

	if (tagNotes.length === 0) {
		return [];
	}

	const tags: {
		name: string;
		users: Note['userId'][];
	}[] = [];

	for (const note of tagNotes) {
		for (const tag of note.tags) {
			if (hiddenTags.includes(tag)) continue;

			const x = tags.find(x => x.name === tag);
			if (x) {
				if (!x.users.includes(note.userId)) {
					x.users.push(note.userId);
				}
			} else {
				tags.push({
					name: tag,
					users: [note.userId],
				});
			}
		}
	}

	const hots = tags
		.sort((a, b) => b.users.length - a.users.length)
		.map(tag => tag.name)
		.slice(0, max);

	const countPromises: Promise<number[]>[] = [];
	const range = 20;
	const interval = 1000 * 60 * 10;

	for (let i = 0; i < range; i++) {
		countPromises.push(Promise.all(hots.map(tag => Notes.createQueryBuilder('note')
			.select('count(distinct note.userId)')
			.where(`'{"${safeForSql(tag) ? tag : 'aichan_kawaii'}"}' <@ note.tags`)
			.andWhere('note.createdAt < :lt', { lt: new Date(now.getTime() - (interval * i)) })
			.andWhere('note.createdAt > :gt', { gt: new Date(now.getTime() - (interval * (i + 1))) })
			.cache(60000)
			.getRawOne()
			.then(x => parseInt(x.count, 10))
		)));
	}

	const countsLog = await Promise.all(countPromises);

	const totalCounts = await Promise.all(hots.map(tag => Notes.createQueryBuilder('note')
		.select('count(distinct note.userId)')
		.where(`'{"${safeForSql(tag) ? tag : 'aichan_kawaii'}"}' <@ note.tags`)
		.andWhere('note.createdAt > :gt', { gt: new Date(now.getTime() - rangeA) })
		.cache(60000 * 60)
		.getRawOne()
		.then(x => parseInt(x.count, 10))
	));

	return hots.map((tag, i) => ({
		tag,
		chart: countsLog.map(counts => counts[i]),
		usersCount: totalCounts[i],
	}));
}
