<template>
	<div class="mvcprjjd" :class="{ iconOnly: iconOnly, drawer: isDrawer }">
		<div class="body">
			<div class="top">
				<div class="banner" :style="{ backgroundImage: `url(${instance.bannerUrl})` }"></div>
				<div class="logo-section">
					<img :src="instance.iconUrl || instance.faviconUrl || '/favicon.ico'" alt="Instance logo"
						class="instance-logo" />
					<h2 class="instance-name" v-if="!iconOnly">{{ instance.name || 'BARKLE' }}</h2>
					<p class="tagline" v-if="!iconOnly">Bark it out!</p>
				</div>
			</div>
			<div class="middle">
				<MkA v-click-anime v-tooltip.noDelay.right="i18n.ts.timeline" class="item index" active-class="active"
					to="/" exact>
					<i class="icon ph-house-bold ph-lg ph-fw ph-lg"></i><span class="text">{{ i18n.ts.timeline }}</span>
				</MkA>
				<MkA v-click-anime v-tooltip.noDelay.right="i18n.ts.explore" class="item explore" active-class="active"
					to="/explore">
					<i class="icon ph-hash-bold ph-lg ph-fw ph-lg"></i><span class="text">{{ i18n.ts.explore }}</span>
				</MkA>
				<MkA v-click-anime v-tooltip.noDelay.right="i18n.ts.channel" class="item channels" active-class="active"
					to="/channels">
					<i class="icon ph-television-bold ph-lg ph-fw ph-lg"></i><span class="text">{{ i18n.ts.channel
						}}</span>
				</MkA>
				<button v-click-anime v-tooltip.noDelay.right="i18n.ts.search" class="item search _button"
					@click="search">
					<i class="icon ph-magnifying-glass-bold ph-lg ph-fw ph-lg"></i><span class="text">{{ i18n.ts.search
						}}</span>
				</button>
				<!-- App Download Button for Mobile Guest -->
				<MkAppDownloadButton v-if="!iconOnly" />
			</div>
			<div class="bottom">
				<button class="item _button signin" @click="signin()">
					<i class="icon ph-sign-in-bold ph-lg ph-fw ph-lg"></i><span class="text">{{ i18n.ts.login }}</span>
				</button>
				<button class="item _button signup" @click="signup()">
					<i class="icon ph-user-plus-bold ph-lg ph-fw ph-lg"></i><span class="text">{{ i18n.ts.signup
						}}</span>
				</button>
				<button v-click-anime v-tooltip.noDelay.right="'Open Source'" class="item _button open-source"
					@click="openSourceInfo">
					<i class="icon ph-code-bold ph-lg ph-fw ph-lg"></i><span class="text">Open Source</span>
				</button>
				<button v-click-anime v-tooltip.noDelay.right="instance.name ?? i18n.ts.instance"
					class="item _button instance" @click="openInstanceMenu">
					<img :src="instance.iconUrl || instance.faviconUrl || '/favicon.ico'" alt="" class="icon" />
				</button>
			</div>
		</div>
	</div>
</template>

<script lang="ts">
import { defineComponent, defineAsyncComponent } from 'vue';
import { host } from '@/config';
import * as os from '@/os';
import { popups } from '@/os';
import { i18n } from '@/i18n';
import { instance } from '@/instance';
import { search as search_ } from '@/scripts/search';
import MkAppDownloadButton from '@/components/MkAppDownloadButton.vue';

export default defineComponent({
	components: {
		MkAppDownloadButton,
	},
	props: {
		isDrawer: {
			type: Boolean,
			default: false,
		},
	},

	data() {
		return {
			iconOnly: false,
			host,
			i18n,
			instance,
		};
	},

	mounted() {
		this.calcViewState();

		if (!this.isDrawer) {
			window.addEventListener('resize', this.calcViewState);
		}
	},

	unmounted() {
		if (!this.isDrawer) {
			window.removeEventListener('resize', this.calcViewState);
		}
	},

	methods: {
		calcViewState() {
			if (this.isDrawer) {
				this.iconOnly = false; // Drawer is always full width
			} else {
				this.iconOnly = (window.innerWidth <= 1279);
			}
		},

		signin() {
			console.log('🔐 signin() called');
			console.log('📊 popups before:', popups.value.length);

			const result = os.popup(defineAsyncComponent(() => import('@/components/MkSigninDialog.vue')), {
				autoSet: true
			}, {}, 'closed');

			console.log('📊 popups after:', popups.value.length);
			console.log('📊 popup result:', result);

			// Watch for changes
			setTimeout(() => {
				console.log('📊 popups after 100ms:', popups.value.length);
				console.log('📊 popups content:', popups.value);
			}, 100);
		},

		signup() {
			console.log('📝 signup() called');
			console.log('📊 popups before:', popups.value.length);

			const result = os.popup(defineAsyncComponent(() => import('@/components/MkSignupDialog.vue')), {
				autoSet: true
			}, {}, 'closed');

			console.log('📊 popups after:', popups.value.length);
			console.log('📊 popup result:', result);

			// Watch for changes
			setTimeout(() => {
				console.log('📊 popups after 100ms:', popups.value.length);
				console.log('📊 popups content:', popups.value);
			}, 100);
		},

		search() {
			search_();
		},

		openInstanceMenu(ev: MouseEvent) {
			os.popupMenu([{
				text: instance.name ?? host,
				type: 'label',
			}, {
				type: 'link',
				text: 'About',
				icon: 'ph-info-bold ph-lg',
				to: '/about',
			}, null, {
				type: 'link',
				to: '/mfm-cheat-sheet',
				text: i18n.ts._mfm.cheatSheet,
				icon: 'ph-code-bold ph-lg',
			}], ev.currentTarget as HTMLElement, {
				align: 'left',
			});
		},

		openSourceInfo(ev: MouseEvent) {
			os.popupMenu([{
				text: 'Barkle is Open Source',
				type: 'label',
			}, {
				text: 'Built upon:',
				type: 'label',
			}, {
				text: 'Misskey',
				icon: 'ph-code-bold ph-lg',
				action: () => {
					window.open('https://github.com/misskey-dev/misskey', '_blank', 'noopener');
				},
			}, {
				text: 'Calckey',
				icon: 'ph-code-bold ph-lg',
				action: () => {
					window.open('https://codeberg.org/calckey/calckey', '_blank', 'noopener');
				},
			}, null, {
				text: 'Barkle Source Code',
				icon: 'ph-github-logo-bold ph-lg',
				action: () => {
					window.open('https://github.com/BarkleAPP/Barkle-oss', '_blank', 'noopener');
				},
			}, null, {
				text: 'License: AGPL-3.0 (Upstream)',
				type: 'label',
			}], ev.currentTarget as HTMLElement, {
				align: 'left',
			});
		},
	},
});
</script>

<style lang="scss" scoped>
.mvcprjjd {
	$nav-width: 250px;
	$nav-icon-only-width: 80px;

	flex: 0 0 $nav-width;
	width: $nav-width;
	box-sizing: border-box;

	>.body {
		position: fixed;
		top: 0;
		left: 0;
		z-index: 1001;
		width: $nav-icon-only-width;
		// ほんとは単に 100vh と書きたいところだが... https://css-tricks.com/the-trick-to-viewport-units-on-mobile/
		height: calc(var(--vh, 1vh) * 100);
		box-sizing: border-box;
		overflow: auto;
		overflow-x: clip;
		background: var(--navBg);
		contain: strict;
		display: flex;
		flex-direction: column;
	}

	&:not(.iconOnly) {
		>.body {
			width: $nav-width;

			>.top {
				position: sticky;
				top: 0;
				z-index: 1;
				padding: 2rem 0;
				background: var(--X14);
				-webkit-backdrop-filter: var(--blur, blur(8px));
				backdrop-filter: var(--blur, blur(8px));

				>.banner {
					position: absolute;
					top: 0;
					left: 0;
					width: 100%;
					height: 100%;
					background-size: cover;
					background-position: center center;
					-webkit-mask-image: linear-gradient(0deg, rgba(0, 0, 0, 0) 15%, rgba(0, 0, 0, 0.75) 100%);
					mask-image: linear-gradient(0deg, rgba(0, 0, 0, 0) 15%, rgba(0, 0, 0, 0.75) 100%);
				}

				>.logo-section {
					position: relative;
					display: flex;
					flex-direction: column;
					align-items: center;
					justify-content: center;
					width: 100%;
					padding: 0;

					>.instance-logo {
						width: 48px;
						height: 48px;
						border-radius: 50%;
						margin-bottom: 0.5rem;
						flex-shrink: 0;
					}

					>.instance-name {
						font-size: 1.2rem;
						font-weight: bold;
						color: var(--accent);
						margin: 0 0 0.25rem 0;
						text-shadow: 0 0 10px rgba(var(--accent), 0.3);
						text-align: center;
						width: 100%;
					}

					>.tagline {
						font-size: 0.85rem;
						color: var(--fg);
						opacity: 0.8;
						margin: 0;
						font-weight: 500;
						text-align: center;
						width: 100%;
					}
				}
			}

			>.bottom {
				position: sticky;
				bottom: 0;
				padding: 20px 0;
				background: var(--X14);
				-webkit-backdrop-filter: var(--blur, blur(8px));
				backdrop-filter: var(--blur, blur(8px));

				>.signin {
					position: relative;
					display: block;
					width: 100%;
					height: 40px;
					color: var(--accent);
					font-weight: bold;
					text-align: left;
					border: 2px solid var(--accent);
					border-radius: 12px;
					margin-bottom: 8px;
					transition: all 0.3s ease;
					min-height: 40px;
					max-height: 40px;

					&:hover {
						background: rgba(var(--accent), 0.1);
						transform: translateY(-2px);
					}

					>.icon,
					>.text {
						position: relative;
						left: 3rem;
						color: var(--accent);
					}

					>.text {
						margin-left: 1rem;
					}
				}

				>.signup {
					position: relative;
					display: block;
					width: 100%;
					height: 40px;
					color: var(--fgOnAccent);
					font-weight: bold;
					text-align: left;
					background: linear-gradient(90deg, var(--buttonGradateA), var(--buttonGradateB));
					border-radius: 12px;
					margin-bottom: 16px;
					transition: all 0.3s ease;
					min-height: 40px;
					max-height: 40px;

					&:hover {
						transform: translateY(-2px);
						box-shadow: 0 4px 12px rgba(var(--accent), 0.3);
					}

					>.icon,
					>.text {
						position: relative;
						left: 3rem;
						color: var(--fgOnAccent);
					}

					>.text {
						margin-left: 1rem;
					}
				}

				>.open-source {
					position: relative;
					display: block;
					width: 100%;
					height: 40px;
					color: var(--fg);
					font-weight: 500;
					text-align: left;
					border: 1px solid var(--divider);
					border-radius: 12px;
					margin-bottom: 16px;
					transition: all 0.3s ease;
					min-height: 40px;
					max-height: 40px;

					&:hover {
						background: var(--buttonHoverBg);
						transform: translateY(-2px);
					}

					>.icon,
					>.text {
						position: relative;
						left: 3rem;
						color: var(--fg);
					}

					>.text {
						margin-left: 1rem;
					}
				}

				>.instance {
					position: relative;
					display: block;
					text-align: center;
					width: 100%;

					>.icon {
						display: inline-block;
						width: 32px !important;
						aspect-ratio: 1;
						margin-top: 1rem;
					}
				}
			}

			>.middle {
				flex: 0.1;

				>.item {
					position: relative;
					display: block;
					padding-left: 30px;
					line-height: 2.85rem;
					margin-bottom: 0.5rem;
					text-overflow: ellipsis;
					overflow: hidden;
					white-space: nowrap;
					width: 100%;
					text-align: left;
					box-sizing: border-box;
					color: var(--navFg);

					>.icon {
						position: relative;
						width: 32px;
						margin-right: 8px;
						transform: translateY(0.15em);
					}

					>.text {
						position: relative;
						font-size: 0.9em;
					}

					&:hover {
						text-decoration: none;
						color: var(--navHoverFg);
						transition: all 0.4s ease;
					}

					&.active {
						color: var(--navActive);
					}

					&:hover,
					&.active {
						color: var(--accent);
						transition: all 0.4s ease;

						&:before {
							content: "";
							display: block;
							width: calc(100% - 34px);
							height: 100%;
							margin: auto;
							position: absolute;
							top: 0;
							left: 0;
							right: 0;
							bottom: 0;
							border-radius: 999px;
							background: var(--accentedBg);
						}
					}
				}
			}
		}
	}

	&.iconOnly {
		flex: 0 0 $nav-icon-only-width;
		width: $nav-icon-only-width;

		>.body {
			width: $nav-icon-only-width;

			>.top {
				position: sticky;
				top: 0;
				z-index: 1;
				padding: 2rem 0;
				background: var(--X14);
				-webkit-backdrop-filter: var(--blur, blur(8px));
				backdrop-filter: var(--blur, blur(8px));

				>.logo-section {
					display: flex;
					flex-direction: column;
					align-items: center;
					justify-content: center;
					width: 100%;

					>.instance-logo {
						width: 40px;
						height: 40px;
						border-radius: 50%;
						margin-bottom: 0.25rem;
						flex-shrink: 0;
					}

					>.instance-name {
						font-size: 0.9rem;
						font-weight: bold;
						color: var(--accent);
						margin: 0;
						text-shadow: 0 0 8px rgba(var(--accent), 0.3);
						transform: rotate(-90deg);
						white-space: nowrap;
						max-width: 80px;
						overflow: hidden;
						text-overflow: ellipsis;
						text-align: center;
					}
				}
			}

			>.bottom {
				position: sticky;
				bottom: 0;
				padding: 20px 0;
				background: var(--X14);
				-webkit-backdrop-filter: var(--blur, blur(8px));
				backdrop-filter: var(--blur, blur(8px));

				>.signin {
					display: block;
					position: relative;
					width: 100%;
					height: 52px;
					margin-bottom: 8px;
					text-align: center;
					border: 2px solid var(--accent);
					border-radius: 12px;
					min-height: 52px;
					max-height: 52px;

					&:hover {
						background: rgba(var(--accent), 0.1);
					}

					>.icon {
						display: block;
						margin: 0 auto;
						color: var(--accent);
						transform: translateY(0.15em);
					}

					>.text {
						display: none;
					}
				}

				>.signup {
					display: block;
					position: relative;
					width: 100%;
					height: 52px;
					margin-bottom: 16px;
					text-align: center;
					background: linear-gradient(90deg, var(--buttonGradateA), var(--buttonGradateB));
					border-radius: 12px;
					min-height: 52px;
					max-height: 52px;

					&:hover {
						box-shadow: 0 4px 12px rgba(var(--accent), 0.3);
					}

					>.icon {
						display: block;
						margin: 0 auto;
						color: var(--fgOnAccent);
						transform: translateY(0.15em);
					}

					>.text {
						display: none;
					}
				}

				>.open-source {
					display: block;
					position: relative;
					width: 100%;
					height: 52px;
					margin-bottom: 16px;
					text-align: center;
					border: 1px solid var(--divider);
					border-radius: 12px;
					min-height: 52px;
					max-height: 52px;

					&:hover {
						background: var(--buttonHoverBg);
					}

					>.icon {
						display: block;
						margin: 0 auto;
						color: var(--fg);
						transform: translateY(0.15em);
					}

					>.text {
						display: none;
					}
				}

				>.instance {
					position: relative;
					display: block;
					text-align: center;
					width: 100%;

					>.icon {
						display: inline-block;
						width: 32px !important;
						aspect-ratio: 1;
					}
				}
			}

			>.middle {
				flex: 0.1;

				>.item {
					display: block;
					position: relative;
					padding: 1.1rem 0;
					margin-bottom: 0.2rem;
					width: 100%;
					text-align: center;

					>.icon {
						display: block;
						margin: 0 auto;
						opacity: 0.7;
						transform: translateY(0em);
					}

					>.text {
						display: none;
					}

					&:hover,
					&.active {
						text-decoration: none;
						color: var(--accent);
						transition: all 0.4s ease;

						&:before {
							content: "";
							display: block;
							height: 100%;
							aspect-ratio: 1;
							margin: auto;
							position: absolute;
							top: 0;
							left: 0;
							right: 0;
							bottom: 0;
							border-radius: 999px;
							background: var(--accentedBg);
						}

						>.icon,
						>.text {
							opacity: 1;
						}
					}
				}
			}
		}
	}

	// Drawer mode styles (mobile overlay)
	&.drawer {
		position: fixed;
		top: 0;
		left: 0;
		z-index: 1001;
		width: 240px;
		height: 100vh;
		background: var(--navBg);
		box-shadow: 0 0 16px rgba(0, 0, 0, 0.1);

		>.body {
			position: relative;
			width: 100%;
			height: 100%;
			overflow-y: auto;
			background: var(--navBg);

			>.top {
				position: sticky;
				top: 0;
				z-index: 1;
				padding: 1.5rem 0;
				background: var(--X14);
				-webkit-backdrop-filter: var(--blur, blur(8px));
				backdrop-filter: var(--blur, blur(8px));

				>.logo-section {
					>.instance-logo {
						width: 36px;
						height: 36px;
					}

					>.instance-name {
						font-size: 1rem;
						overflow: hidden;
						text-overflow: ellipsis;
						white-space: nowrap;
					}

					>.tagline {
						font-size: 0.8rem;
						overflow: hidden;
						text-overflow: ellipsis;
						white-space: nowrap;
					}
				}
			}

			>.bottom {
				padding: 16px;

				>.signin,
				>.signup {
					height: 44px;
					display: flex;
					align-items: center;
					border-radius: 8px;
					cursor: pointer;
					overflow: hidden;

					>.icon {
						margin-left: 16px;
						margin-right: 12px;
						width: 20px;
						flex-shrink: 0;
					}

					>.text {
						font-size: 0.9rem;
						flex: 1;
						overflow: hidden;
						text-overflow: ellipsis;
						white-space: nowrap;
					}
				}

				>.signin {
					margin-bottom: 8px;
					border: 2px solid var(--accent);
					color: var(--accent);

					&:hover {
						background: rgba(var(--accent), 0.1);
					}
				}

				>.signup {
					margin-bottom: 12px;
					background: linear-gradient(90deg, var(--buttonGradateA), var(--buttonGradateB));
					color: var(--fgOnAccent);

					&:hover {
						box-shadow: 0 4px 12px rgba(var(--accent), 0.3);
					}
				}

				>.instance {
					margin-top: 8px;
					text-align: center;

					>.icon {
						width: 28px !important;
						height: 28px;
					}
				}
			}

			>.middle {
				flex: 1;
				padding: 0 8px;

				>.item {
					padding-left: 16px;
					line-height: 2.5rem;
					margin-bottom: 4px;
					border-radius: 8px;
					cursor: pointer;

					>.icon {
						width: 24px;
						margin-right: 12px;
					}

					>.text {
						font-size: 0.85rem;
					}

					&:hover,
					&.active {
						background: var(--accentedBg);
						color: var(--accent);

						&:before {
							display: none;
						}
					}
				}
			}
		}
	}
}
</style>
