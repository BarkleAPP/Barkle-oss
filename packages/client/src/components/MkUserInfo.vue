<template>
<div class="_panel vjnjpkug">
	<div class="banner" :style="user.bannerUrl ? `background-image: url(${user.bannerUrl})` : ''"></div>
	<MkAvatar class="avatar" :user="user" :disable-preview="true" :show-indicator="true"/>
	<div class="title">
		<MkA class="name" :to="userPage(user)"><MkUserName :user="user" :nowrap="false"/></MkA>
		<p class="username"><MkAcct :user="user"/></p>
	</div>
	<div class="description">
		<div v-if="user.description" class="mfm">
			<Mfm :text="user.description" :author="user" :i="$i" :custom-emojis="user.emojis"/>
		</div>
		<span v-else style="opacity: 0.7;">{{ i18n.ts.noAccountDescription }}</span>
	</div>
	<!-- Enhanced: Add social proof indicators -->
	<div v-if="user.socialProof" class="social-proof">
		<div v-if="user.socialProof.mutualConnections > 0" class="mutual-connections">
			<i class="ph-users-bold ph-sm"></i>
			{{ i18n.t('_growth.mutualConnections', { count: user.socialProof.mutualConnections }) }}
		</div>
		<div v-if="user.socialProof.isContactMatch" class="contact-match">
			<i class="ph-address-book-bold ph-sm"></i>
			{{ i18n.ts._growth.fromYourContacts }}
		</div>
	</div>
	<div class="status">
		<div>
			<p>{{ i18n.ts.notes }}</p><span>{{ user.notesCount }}</span>
		</div>
		<div>
			<p>{{ i18n.ts.following }}</p><span>{{ user.followingCount }}</span>
		</div>
		<div>
			<p>{{ i18n.ts.followers }}</p><span>{{ user.followersCount }}</span>
		</div>
	</div>
	<MkFollowButton v-if="$i && user.id != $i.id" class="koudoku-button" :user="user" mini/>
</div>
</template>

<script lang="ts" setup>
import * as misskey from 'calckey-js';
import MkFollowButton from '@/components/MkFollowButton.vue';
import { userPage } from '@/filters/user';
import { i18n } from '@/i18n';

defineProps<{
	user: misskey.entities.UserDetailed;
}>();
</script>

<style lang="scss" scoped>
.vjnjpkug {
	position: relative;

	> .banner {
		height: 84px;
		background-color: rgba(0, 0, 0, 0.1);
		background-size: cover;
		background-position: center;

	}

	> .avatar {
		display: block;
		position: absolute;
		top: 62px;
		left: 13px;
		z-index: 2;
		width: 58px;
		height: 58px;
		border: solid 4px var(--panel);
	}

	> .title {
		display: block;
		padding: 10px 0 10px 88px;

		> .name {
			display: inline-block;
			margin: 0;
			font-weight: bold;
			line-height: 16px;
			word-break: break-all;
		}

		> .username {
			display: block;
			margin: 0;
			line-height: 16px;
			font-size: 0.8em;
			color: var(--fg);
			opacity: 0.7;
		}
	}

	> .description {
		padding: 16px;
		font-size: 0.8em;
		border-top: solid 0.5px var(--divider);

		> .mfm {
			display: -webkit-box;
			-webkit-line-clamp: 3;
			-webkit-box-orient: vertical;
			overflow: hidden;
		}
	}

	> .social-proof {
		padding: 8px 16px;
		border-top: solid 0.5px var(--divider);
		display: flex;
		flex-direction: column;
		gap: 4px;

		.mutual-connections, .contact-match {
			display: flex;
			align-items: center;
			gap: 6px;
			font-size: 0.75em;
			color: var(--accent);
			font-weight: 500;

			i {
				opacity: 0.8;
			}
		}

		.contact-match {
			color: var(--success);
		}
	}

	> .status {
		padding: 10px 16px;
		border-top: solid 0.5px var(--divider);

		> div {
			display: inline-block;
			width: 33%;

			> p {
				margin: 0;
				font-size: 0.7em;
				color: var(--fg);
			}

			> span {
				font-size: 1em;
				color: var(--accent);
			}
		}
	}

	> .koudoku-button {
		position: absolute;
		top: 8px;
		right: 8px;
	}
}
</style>
