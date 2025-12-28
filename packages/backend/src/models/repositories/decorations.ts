import { db } from '@/db/postgre.js';
import { Decoration } from '@/models/entities/decoration.js';
import { Packed } from '@/misc/schema.js';
import { User } from '@/models/entities/user.js';

export const DecorationsRepository = db.getRepository(Decoration).extend({
    async pack(
        src: Decoration['id'] | Decoration,
    ): Promise<Packed<'Decorations'>> {
        const decorations = typeof src === 'object' ? src : await this.findOneByOrFail({ id: src });
        
        // Fetch the credit user if credit ID exists
        let creditUsername: string | null = null;
        if (decorations.credit) {
            const creditUser = await db.getRepository(User).findOne({
                where: { id: decorations.credit },
                select: ['username']
            });
            creditUsername = creditUser?.username ?? null;
        }

        return {
            id: decorations.id,
            aliases: decorations.aliases,
            name: decorations.name,
            category: decorations.category,
            host: decorations.host,
            // || emoji.originalUrl してるのは後方互換性のため
            url: decorations.publicUrl || decorations.originalUrl,
            isPlus: decorations.isPlus,
            isMPlus: decorations.isMPlus,
            credit: decorations.credit,
            //creditUname: creditUsername,
        };
    },

    packMany(
        decorations: any[],
    ) {
        return Promise.all(decorations.map(x => this.pack(x)));
    },
});