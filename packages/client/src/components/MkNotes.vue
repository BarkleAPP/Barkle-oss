<template>
	<MkPagination ref="pagingComponent" :pagination="pagination">
	  <template #empty>
		<div class="empty-timeline">
		  <div class="_fullinfo">
			<img src="https://barkle.chat/static-assets/badges/info.png" class="_ghost" alt="Info"/>
			<div>{{ i18n.ts.noNotes }}</div>
		  </div>
		  <div v-if="$i && (pagination.endpoint === 'notes/timeline' || pagination.endpoint === 'barks/recommended-timeline')" class="follow-suggestions">
			<FollowSuggestions :compact="true" :show-header="true" />
		  </div>
		</div>
	  </template>
	  <template #default="{ items: notes }">
		<div class="giivymft" :class="{ noGap }">
		  <component 
			:is="useDateSeparator ? XDateList : XSimpleList"
			ref="notes" 
			v-slot="{ item: note }" 
			:items="notes" 
			:direction="pagination.reversed ? 'up' : 'down'" 
			:reversed="pagination.reversed" 
			:no-gap="noGap" 
			:ad="true" 
			class="notes"
		  >
			<XNote :key="note._featuredId_ || note._prId_ || note.id" class="qtqtichx" :note="note"/>
		  </component>
		</div>
	  </template>
	</MkPagination>
  </template>
  
  <script lang="ts" setup>
  import { ref } from 'vue';
  import type { Paging } from '@/components/MkPagination.vue';
  import XNote from '@/components/MkNote.vue';
  import XDateList from '@/components/MkDateSeparatedList.vue';
  import XSimpleList from '@/components/MkSimpleList.vue';
  import MkPagination from '@/components/MkPagination.vue';
  import FollowSuggestions from '@/components/growth/FollowSuggestions.vue';
  import { i18n } from '@/i18n';
  import { $i } from '@/account';
  
  const props = defineProps<{
	pagination: Paging;
	noGap?: boolean;
	useDateSeparator?: boolean;
  }>();
  
  const pagingComponent = ref<InstanceType<typeof MkPagination>>();
  
  defineExpose({
	pagingComponent,
  });
  </script>
  
  <style lang="scss" scoped>
  .empty-timeline {
	.follow-suggestions {
	  margin-top: 2rem;
	  padding: 0 1rem;
	}
  }
  
  .giivymft {
	&.noGap {
	  > .notes {
		> .qtqtichx:not(:last-child) {
		  margin-bottom: 0;
		  border-radius: 0;
		}
	  }
	}
  }
  </style>
  
  <style lang="scss" scoped>
  .giivymft {
	&.noGap {
	  > .notes {
		background: var(--panel);
	  }
	}
	&:not(.noGap) {
	  > .notes {
		background: var(--bg);
		.qtqtichx {
		  background: var(--panel);
		  border-radius: var(--radius);
		}
	  }
	}
  }
  </style>