<template>
    <div>
        <MkSpacer :content-max="700" :margin-min="16" :margin-max="32">
            <FormSuspense :p="init">
                <div class="_formRoot">
                    <FormSection>
                        <template #label>A/B Testing Overview</template>

                        <div class="overview-stats">
                            <div class="stat-card">
                                <div class="stat-value">{{ stats.activeExperiments || 0 }}</div>
                                <div class="stat-label">Active Experiments</div>
                            </div>

                            <div class="stat-card">
                                <div class="stat-value">{{ stats.totalUsers || 0 }}</div>
                                <div class="stat-label">Users in Experiments</div>
                            </div>

                            <div class="stat-card">
                                <div class="stat-value">{{ stats.experimentsWithResults || 0 }}</div>
                                <div class="stat-label">Experiments with Results</div>
                            </div>
                        </div>
                    </FormSection>

                    <FormSection>
                        <template #label>Create Custom A/B Test</template>

                        <div class="create-experiment-form">
                            <MkButton @click="showCreateForm = !showCreateForm" :class="{ active: showCreateForm }">
                                <i class="ph-plus-bold ph-lg"></i>
                                {{ showCreateForm ? 'Cancel' : 'Create New Experiment' }}
                            </MkButton>

                            <div v-if="showCreateForm" class="experiment-form">
                                <div class="form-grid">
                                    <div class="form-group">
                                        <label>Experiment Name</label>
                                        <FormInput v-model="newExperiment.name"
                                            placeholder="e.g., Content Quality vs Speed Test" />
                                    </div>

                                    <div class="form-group">
                                        <label>Description</label>
                                        <FormTextarea v-model="newExperiment.description"
                                            placeholder="Describe what this experiment tests..." />
                                    </div>

                                    <div class="form-group">
                                        <label>Traffic Allocation (%)</label>
                                        <FormRange v-model="newExperiment.trafficAllocation" :min="1" :max="50"
                                            :step="1" />
                                        <span class="range-value">{{ newExperiment.trafficAllocation }}%</span>
                                    </div>

                                    <div class="form-group">
                                        <label>Primary Metric</label>
                                        <FormSelect v-model="newExperiment.primaryMetric">
                                            <option value="engagement_rate">Engagement Rate</option>
                                            <option value="dwell_time">Dwell Time</option>
                                            <option value="click_through_rate">Click Through Rate</option>
                                            <option value="content_discovery_rate">Content Discovery Rate</option>
                                            <option value="user_satisfaction">User Satisfaction</option>
                                            <option value="session_length">Session Length</option>
                                            <option value="follow_rate">Follow Rate</option>
                                        </FormSelect>
                                    </div>
                                </div>

                                <div class="variants-section">
                                    <h4>Experiment Variants</h4>

                                    <div v-for="(variant, index) in newExperiment.variants" :key="index"
                                        class="variant-config">
                                        <div class="variant-header">
                                            <h5>Variant {{ index + 1 }}: {{ variant.name || 'Unnamed' }}</h5>
                                            <MkButton v-if="newExperiment.variants.length > 2"
                                                @click="removeVariant(index)" size="small" danger>
                                                <i class="ph-trash-bold ph-lg"></i>
                                            </MkButton>
                                        </div>

                                        <div class="variant-form">
                                            <div class="form-row">
                                                <div class="form-group">
                                                    <label>Variant Name</label>
                                                    <FormInput v-model="variant.name"
                                                        placeholder="e.g., High Quality" />
                                                </div>

                                                <div class="form-group">
                                                    <label>Traffic Split (%)</label>
                                                    <FormRange v-model="variant.allocation" :min="10" :max="90"
                                                        :step="5" />
                                                    <span class="range-value">{{ (variant.allocation * 100).toFixed(0)
                                                    }}%</span>
                                                </div>
                                            </div>

                                            <div class="algorithm-weights">
                                                <h6>Algorithm Weights</h6>
                                                <div class="weights-grid">
                                                    <div class="weight-control">
                                                        <label>Relevance</label>
                                                        <FormRange v-model="variant.config.weights.relevance" :min="0"
                                                            :max="1" :step="0.1" />
                                                        <span>{{ variant.config.weights.relevance.toFixed(1) }}</span>
                                                    </div>

                                                    <div class="weight-control">
                                                        <label>Diversity</label>
                                                        <FormRange v-model="variant.config.weights.diversity" :min="0"
                                                            :max="1" :step="0.1" />
                                                        <span>{{ variant.config.weights.diversity.toFixed(1) }}</span>
                                                    </div>

                                                    <div class="weight-control">
                                                        <label>Freshness</label>
                                                        <FormRange v-model="variant.config.weights.freshness" :min="0"
                                                            :max="1" :step="0.1" />
                                                        <span>{{ variant.config.weights.freshness.toFixed(1) }}</span>
                                                    </div>

                                                    <div class="weight-control">
                                                        <label>Quality</label>
                                                        <FormRange v-model="variant.config.weights.quality" :min="0"
                                                            :max="1" :step="0.1" />
                                                        <span>{{ variant.config.weights.quality.toFixed(1) }}</span>
                                                    </div>

                                                    <div class="weight-control">
                                                        <label>Personalization</label>
                                                        <FormRange v-model="variant.config.weights.personalization"
                                                            :min="0" :max="1" :step="0.1" />
                                                        <span>{{ variant.config.weights.personalization.toFixed(1)
                                                        }}</span>
                                                    </div>

                                                    <div class="weight-control">
                                                        <label>Serendipity</label>
                                                        <FormRange v-model="variant.config.weights.serendipity" :min="0"
                                                            :max="1" :step="0.1" />
                                                        <span>{{ variant.config.weights.serendipity.toFixed(1) }}</span>
                                                    </div>
                                                </div>
                                            </div>

                                            <div class="mmr-config">
                                                <h6>MMR Configuration</h6>
                                                <div class="mmr-controls">
                                                    <div class="form-group">
                                                        <label>
                                                            <FormSwitch v-model="variant.config.mmr.enabled" />
                                                            Enable MMR Diversification
                                                        </label>
                                                    </div>

                                                    <div v-if="variant.config.mmr.enabled" class="mmr-params">
                                                        <div class="weight-control">
                                                            <label>Lambda (Diversity vs Relevance)</label>
                                                            <FormRange v-model="variant.config.mmr.lambda" :min="0"
                                                                :max="1" :step="0.1" />
                                                            <span>{{ variant.config.mmr.lambda.toFixed(1) }}</span>
                                                        </div>

                                                        <div class="weight-control">
                                                            <label>Similarity Threshold</label>
                                                            <FormRange v-model="variant.config.mmr.similarityThreshold"
                                                                :min="0" :max="1" :step="0.1" />
                                                            <span>{{ variant.config.mmr.similarityThreshold.toFixed(1)
                                                            }}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <MkButton @click="addVariant" size="small">
                                        <i class="ph-plus-bold ph-lg"></i>
                                        Add Variant
                                    </MkButton>
                                </div>

                                <div class="form-actions">
                                    <MkButton @click="createExperiment" :loading="creating" primary>
                                        <i class="ph-flask-bold ph-lg"></i>
                                        Create Experiment
                                    </MkButton>

                                    <MkButton @click="resetForm">
                                        Reset Form
                                    </MkButton>
                                </div>
                            </div>
                        </div>
                    </FormSection>

                    <FormSection>
                        <template #label>Active Experiments</template>

                        <div v-if="experiments.length === 0" class="empty-state">
                            <i class="ph-flask-bold ph-lg"></i>
                            <p>No active experiments</p>
                        </div>

                        <div v-else class="experiments-list">
                            <div v-for="experiment in experiments" :key="experiment.id" class="experiment-card">
                                <div class="experiment-header">
                                    <h4>{{ experiment.name }}</h4>
                                    <div class="experiment-status" :class="experiment.status">
                                        {{ experiment.status.toUpperCase() }}
                                    </div>
                                </div>

                                <p class="experiment-description">{{ experiment.description }}</p>

                                <div class="experiment-details">
                                    <div class="detail">
                                        <span class="label">Traffic:</span>
                                        <span class="value">{{ (experiment.trafficAllocation * 100).toFixed(1)
                                        }}%</span>
                                    </div>
                                    <div class="detail">
                                        <span class="label">Variants:</span>
                                        <span class="value">{{ experiment.variants.length }}</span>
                                    </div>
                                    <div class="detail">
                                        <span class="label">Primary Metric:</span>
                                        <span class="value">{{ experiment.primaryMetric }}</span>
                                    </div>
                                    <div class="detail">
                                        <span class="label">Started:</span>
                                        <span class="value">{{ formatDate(experiment.startDate) }}</span>
                                    </div>
                                </div>

                                <div class="experiment-actions">
                                    <MkButton @click="viewResults(experiment.id)"
                                        :loading="loadingResults === experiment.id" size="small">
                                        <i class="ph-chart-line-bold ph-lg"></i>
                                        View Results
                                    </MkButton>

                                    <MkButton v-if="experiment.status === 'active'"
                                        @click="pauseExperiment(experiment.id)"
                                        :loading="updatingStatus === experiment.id" size="small" danger>
                                        <i class="ph-pause-bold ph-lg"></i>
                                        Pause
                                    </MkButton>

                                    <MkButton v-if="experiment.status === 'paused'"
                                        @click="resumeExperiment(experiment.id)"
                                        :loading="updatingStatus === experiment.id" size="small">
                                        <i class="ph-play-bold ph-lg"></i>
                                        Resume
                                    </MkButton>

                                    <MkButton v-if="experiment.status !== 'completed'"
                                        @click="completeExperiment(experiment.id)"
                                        :loading="updatingStatus === experiment.id" size="small" danger>
                                        <i class="ph-check-bold ph-lg"></i>
                                        Complete
                                    </MkButton>
                                </div>
                            </div>
                        </div>
                    </FormSection>

                    <FormSection v-if="selectedExperimentResults">
                        <template #label>Experiment Results: {{ selectedExperimentResults.experimentId }}</template>

                        <div class="results-container">
                            <div v-for="result in selectedExperimentResults.results" :key="result.variantId"
                                class="variant-results">
                                <h5>{{ result.variantId }} ({{ result.userCount }} users)</h5>

                                <div class="metrics-grid">
                                    <div v-for="(metric, metricName) in result.metrics" :key="metricName"
                                        class="metric-card">
                                        <div class="metric-name">{{ String(metricName).replace(/_/g, ' ').toUpperCase()
                                        }}</div>
                                        <div class="metric-value">{{ metric.value.toFixed(3) }}</div>
                                        <div class="metric-meta">
                                            <span class="sample-size">{{ metric.sampleSize }} samples</span>
                                            <span class="confidence">{{ (metric.confidence * 100).toFixed(1) }}%
                                                confidence</span>
                                            <span v-if="metric.significantDifference"
                                                class="significant">Significant</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </FormSection>

                    <FormSection>
                        <template #label>Timeline Mixing Presets</template>

                        <div class="presets-grid">
                            <div class="preset-card" @click="applyPreset('balanced')">
                                <h5>Balanced</h5>
                                <p>Equal focus on relevance and diversity</p>
                                <div class="preset-config">
                                    Relevance: 40% | Diversity: 30% | Fresh: 20% | Quality: 10%
                                </div>
                            </div>

                            <div class="preset-card" @click="applyPreset('discovery')">
                                <h5>Discovery Focused</h5>
                                <p>Emphasize content discovery and exploration</p>
                                <div class="preset-config">
                                    Diversity: 50% | Relevance: 30% | Serendipity: 20%
                                </div>
                            </div>

                            <div class="preset-card" @click="applyPreset('engagement')">
                                <h5>Engagement Focused</h5>
                                <p>Prioritize high-engagement content</p>
                                <div class="preset-config">
                                    Relevance: 60% | Quality: 25% | Fresh: 15%
                                </div>
                            </div>

                            <div class="preset-card" @click="applyPreset('quality')">
                                <h5>Quality Focused</h5>
                                <p>Emphasize high-quality, safe content</p>
                                <div class="preset-config">
                                    Quality: 40% | Relevance: 35% | Diversity: 25%
                                </div>
                            </div>
                        </div>
                    </FormSection>

                    <FormSection>
                        <template #label>Actions</template>

                        <div class="actions">
                            <MkButton @click="refreshData" :loading="loading">
                                <i class="ph-arrow-clockwise-bold ph-lg"></i>
                                Refresh Data
                            </MkButton>

                            <MkButton @click="cleanupDuplicates" :loading="cleaningUp">
                                <i class="ph-trash-bold ph-lg"></i>
                                Remove Duplicates
                            </MkButton>

                            <MkButton @click="exportResults" :loading="exporting">
                                <i class="ph-download-bold ph-lg"></i>
                                Export Results
                            </MkButton>
                        </div>
                    </FormSection>
                </div>
            </FormSuspense>
        </MkSpacer>
    </div>
</template>

<script lang="ts" setup>
import { onMounted, ref } from 'vue';
import FormSection from '@/components/form/section.vue';
import FormSuspense from '@/components/form/suspense.vue';
import FormInput from '@/components/form/input.vue';
import FormTextarea from '@/components/form/textarea.vue';
import FormRange from '@/components/form/range.vue';
import FormSelect from '@/components/form/select.vue';
import FormSwitch from '@/components/form/switch.vue';
import MkButton from '@/components/MkButton.vue';
import * as os from '@/os';

import { definePageMetadata } from '@/scripts/page-metadata';

const experiments = ref<any[]>([]);
const stats = ref<any>({});
const selectedExperimentResults = ref<any>(null);
const loading = ref(false);
const loadingResults = ref<string | null>(null);
const updatingStatus = ref<string | null>(null);
const exporting = ref(false);
const cleaningUp = ref(false);


// New experiment form
const showCreateForm = ref(false);
const creating = ref(false);
const newExperiment = ref({
    name: '',
    description: '',
    trafficAllocation: 10,
    primaryMetric: 'engagement_rate',
    variants: [
        {
            name: 'Control',
            allocation: 0.5,
            config: createDefaultVariantConfig()
        },
        {
            name: 'Variant A',
            allocation: 0.5,
            config: createDefaultVariantConfig()
        }
    ]
});

function createDefaultVariantConfig() {
    return {
        weights: {
            relevance: 0.4,
            diversity: 0.3,
            freshness: 0.2,
            quality: 0.1,
            personalization: 0.7,
            serendipity: 0.1
        },
        mmr: {
            enabled: true,
            lambda: 0.7,
            similarityThreshold: 0.8
        }
    };
}

const formatDate = (date: string | Date): string => {
    return new Date(date).toLocaleDateString();
};

const refreshData = async () => {
    loading.value = true;
    try {
        const result = await os.api('algorithm/ab-tests' as any, { action: 'list' });
        experiments.value = result.experiments || [];
        stats.value = result.stats || {};
    } catch (error) {
        console.error('Failed to fetch A/B test data:', error);
        os.alert({
            type: 'error',
            text: 'Failed to fetch A/B test data'
        });
    } finally {
        loading.value = false;
    }
};

const viewResults = async (experimentId: string) => {
    loadingResults.value = experimentId;
    try {
        const result = await os.api('algorithm/ab-tests' as any, {
            action: 'results',
            experimentId
        });
        selectedExperimentResults.value = result;
    } catch (error) {
        console.error('Failed to fetch experiment results:', error);
        os.alert({
            type: 'error',
            text: 'Failed to fetch experiment results'
        });
    } finally {
        loadingResults.value = null;
    }
};

const pauseExperiment = async (experimentId: string) => {
    updatingStatus.value = experimentId;
    try {
        await os.api('algorithm/ab-tests' as any, {
            action: 'update_status',
            experimentId,
            status: 'paused'
        });
        await refreshData();
        os.alert({
            type: 'success',
            text: 'Experiment paused successfully'
        });
    } catch (error) {
        console.error('Failed to pause experiment:', error);
        os.alert({
            type: 'error',
            text: 'Failed to pause experiment'
        });
    } finally {
        updatingStatus.value = null;
    }
};

const resumeExperiment = async (experimentId: string) => {
    updatingStatus.value = experimentId;
    try {
        await os.api('algorithm/ab-tests' as any, {
            action: 'update_status',
            experimentId,
            status: 'active'
        });
        await refreshData();
        os.alert({
            type: 'success',
            text: 'Experiment resumed successfully'
        });
    } catch (error) {
        console.error('Failed to resume experiment:', error);
        os.alert({
            type: 'error',
            text: 'Failed to resume experiment'
        });
    } finally {
        updatingStatus.value = null;
    }
};

const completeExperiment = async (experimentId: string) => {
    updatingStatus.value = experimentId;
    try {
        await os.api('algorithm/ab-tests' as any, {
            action: 'update_status',
            experimentId,
            status: 'completed'
        });
        await refreshData();
        os.alert({
            type: 'success',
            text: 'Experiment completed successfully'
        });
    } catch (error) {
        console.error('Failed to complete experiment:', error);
        os.alert({
            type: 'error',
            text: 'Failed to complete experiment'
        });
    } finally {
        updatingStatus.value = null;
    }
};

const applyPreset = async (presetName: string) => {
    try {
        // Define preset configurations
        const presets: Record<string, any> = {
            balanced: {
                weights: {
                    relevance: 0.4,
                    diversity: 0.3,
                    freshness: 0.2,
                    quality: 0.1,
                    personalization: 0.5,
                    serendipity: 0.1
                },
                mmr: { enabled: true, lambda: 0.7, similarityThreshold: 0.8 }
            },
            discovery: {
                weights: {
                    relevance: 0.3,
                    diversity: 0.5,
                    freshness: 0.1,
                    quality: 0.1,
                    personalization: 0.3,
                    serendipity: 0.2
                },
                mmr: { enabled: true, lambda: 0.5, similarityThreshold: 0.7 }
            },
            engagement: {
                weights: {
                    relevance: 0.6,
                    diversity: 0.1,
                    freshness: 0.15,
                    quality: 0.25,
                    personalization: 0.7,
                    serendipity: 0.05
                },
                mmr: { enabled: true, lambda: 0.8, similarityThreshold: 0.85 }
            },
            quality: {
                weights: {
                    relevance: 0.35,
                    diversity: 0.25,
                    freshness: 0.1,
                    quality: 0.4,
                    personalization: 0.5,
                    serendipity: 0.1
                },
                mmr: { enabled: true, lambda: 0.7, similarityThreshold: 0.75 }
            }
        };

        const preset = presets[presetName];
        if (!preset) {
            throw new Error(`Unknown preset: ${presetName}`);
        }

        // Apply the preset to the first variant in the new experiment form
        if (showCreateForm.value && newExperiment.value.variants.length > 0) {
            Object.assign(newExperiment.value.variants[0].config.weights, preset.weights);
            Object.assign(newExperiment.value.variants[0].config.mmr, preset.mmr);

            os.alert({
                type: 'success',
                text: `✅ Applied "${presetName}" preset to Variant 1. Adjust other variants as needed.`
            });
        } else {
            os.alert({
                type: 'info',
                text: `To use this preset, first click "Create New Experiment" button, then click the preset to apply it to Variant 1.`
            });
        }
    } catch (error) {
        console.error('Failed to apply preset:', error);
        os.alert({
            type: 'error',
            text: 'Failed to apply preset configuration'
        });
    }
};

const exportResults = async () => {
    exporting.value = true;
    try {
        // Get all experiment results
        const allResults: any[] = [];

        for (const exp of experiments.value) {
            const result = await os.api('algorithm/ab-tests' as any, {
                action: 'results',
                experimentId: exp.id
            });

            if (result && result.results) {
                allResults.push({
                    experimentId: exp.id,
                    experimentName: exp.name,
                    status: exp.status,
                    startDate: exp.startDate,
                    endDate: exp.endDate,
                    results: result.results
                });
            }
        }

        // Convert to CSV
        const csvRows: string[] = [];
        csvRows.push('Experiment ID,Experiment Name,Status,Variant ID,User Count,Start Date,End Date');

        for (const expResult of allResults) {
            for (const variant of expResult.results) {
                csvRows.push([
                    expResult.experimentId,
                    expResult.experimentName,
                    expResult.status,
                    variant.variantId,
                    variant.userCount,
                    expResult.startDate,
                    expResult.endDate || ''
                ].join(','));
            }
        }

        // Download CSV
        const csvContent = csvRows.join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `barkle-ab-test-results-${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        os.alert({
            type: 'success',
            text: `Exported results for ${experiments.value.length} experiments`
        });
    } catch (error) {
        console.error('Failed to export results:', error);
        os.alert({
            type: 'error',
            text: 'Failed to export experiment results'
        });
    } finally {
        exporting.value = false;
    }
};

const cleanupDuplicates = async () => {
    const confirmed = await os.confirm({
        type: 'warning',
        text: 'This will remove duplicate experiments, keeping only the oldest version of each. Continue?'
    });

    if (!confirmed.canceled) {
        cleaningUp.value = true;
        try {
            const result = await os.api('algorithm/cleanup-duplicates' as any);

            await refreshData();

            os.alert({
                type: 'success',
                text: `Removed ${result.deletedCount} duplicate experiments. ${result.remainingCount} experiments remaining.`
            });
        } catch (error) {
            console.error('Failed to cleanup duplicates:', error);
            os.alert({
                type: 'error',
                text: 'Failed to remove duplicate experiments'
            });
        } finally {
            cleaningUp.value = false;
        }
    }
};

// New experiment form methods
const addVariant = () => {
    newExperiment.value.variants.push({
        name: `Variant ${String.fromCharCode(65 + newExperiment.value.variants.length - 1)}`,
        allocation: 1 / (newExperiment.value.variants.length + 1),
        config: createDefaultVariantConfig()
    });

    // Rebalance allocations
    const equalAllocation = 1 / newExperiment.value.variants.length;
    newExperiment.value.variants.forEach(variant => {
        variant.allocation = equalAllocation;
    });
};

const removeVariant = (index: number) => {
    if (newExperiment.value.variants.length <= 2) return;

    newExperiment.value.variants.splice(index, 1);

    // Rebalance allocations
    const equalAllocation = 1 / newExperiment.value.variants.length;
    newExperiment.value.variants.forEach(variant => {
        variant.allocation = equalAllocation;
    });
};

const resetForm = () => {
    newExperiment.value = {
        name: '',
        description: '',
        trafficAllocation: 10,
        primaryMetric: 'engagement_rate',
        variants: [
            {
                name: 'Control',
                allocation: 0.5,
                config: createDefaultVariantConfig()
            },
            {
                name: 'Variant A',
                allocation: 0.5,
                config: createDefaultVariantConfig()
            }
        ]
    };
    showCreateForm.value = false;
};

const createExperiment = async () => {
    if (!newExperiment.value.name.trim()) {
        os.alert({
            type: 'error',
            text: 'Please enter an experiment name'
        });
        return;
    }

    if (!newExperiment.value.description.trim()) {
        os.alert({
            type: 'error',
            text: 'Please enter an experiment description'
        });
        return;
    }

    // Validate variant names
    const variantNames = newExperiment.value.variants.map(v => v.name.trim());
    if (variantNames.some(name => !name)) {
        os.alert({
            type: 'error',
            text: 'Please name all variants'
        });
        return;
    }

    creating.value = true;
    try {
        const experimentConfig = {
            name: newExperiment.value.name.trim(),
            description: newExperiment.value.description.trim(),
            trafficAllocation: newExperiment.value.trafficAllocation / 100,
            primaryMetric: newExperiment.value.primaryMetric,
            secondaryMetrics: ['dwell_time', 'user_satisfaction'],
            variants: {}
        };

        // Convert variants to the expected format
        newExperiment.value.variants.forEach(variant => {
            experimentConfig.variants[variant.name.toLowerCase().replace(/\s+/g, '_')] = {
                name: variant.name,
                description: `${variant.name} variant configuration`,
                allocation: variant.allocation,
                config: variant.config
            };
        });

        await os.api('algorithm/ab-tests' as any, {
            action: 'create',
            experimentConfig
        });

        os.alert({
            type: 'success',
            text: `Experiment "${newExperiment.value.name}" created successfully!`
        });

        resetForm();
        await refreshData();

    } catch (error) {
        console.error('Failed to create experiment:', error);
        os.alert({
            type: 'error',
            text: 'Failed to create experiment. Please try again.'
        });
    } finally {
        creating.value = false;
    }
};

const init = async () => {
    await refreshData();
};

onMounted(() => {
    // Auto-refresh every 60 seconds
    const interval = setInterval(refreshData, 60000);

    // Cleanup on unmount
    return () => clearInterval(interval);
});

definePageMetadata({
    title: 'Algorithm A/B Tests',
    icon: 'ph-flask-bold ph-lg',
});
</script>

<style lang="scss" scoped>
.overview-stats {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 16px;
    margin-bottom: 24px;
}

.stat-card {
    background: var(--panel);
    border-radius: 8px;
    padding: 16px;
    text-align: center;
    border: 1px solid var(--divider);
}

.stat-value {
    font-size: 2em;
    font-weight: bold;
    color: var(--accent);
    margin-bottom: 4px;
}

.stat-label {
    font-size: 0.9em;
    color: var(--fgTransparentWeak);
}

.experiments-list {
    display: grid;
    gap: 16px;
}

.experiment-card {
    background: var(--panel);
    border-radius: 8px;
    padding: 20px;
    border: 1px solid var(--divider);
}

.experiment-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;

    h4 {
        margin: 0;
        color: var(--fg);
    }
}

.experiment-status {
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 0.8em;
    font-weight: bold;
    text-transform: uppercase;

    &.active {
        background: var(--success);
        color: white;
    }

    &.paused {
        background: var(--warn);
        color: white;
    }

    &.completed {
        background: var(--fg);
        color: var(--bg);
    }

    &.draft {
        background: var(--divider);
        color: var(--fg);
    }
}

.experiment-description {
    color: var(--fgTransparentWeak);
    margin-bottom: 12px;
}

.experiment-details {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: 8px;
    margin-bottom: 16px;
}

.detail {
    display: flex;
    justify-content: space-between;

    .label {
        color: var(--fgTransparentWeak);
    }

    .value {
        font-weight: bold;
        color: var(--accent);
    }
}

.experiment-actions {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
}

.results-container {
    display: grid;
    gap: 20px;
}

.variant-results {
    background: var(--bg);
    border-radius: 8px;
    padding: 16px;
    border: 1px solid var(--divider);

    h5 {
        margin: 0 0 12px 0;
        color: var(--accent);
    }
}

.metrics-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 12px;
}

.metric-card {
    background: var(--panel);
    border-radius: 6px;
    padding: 12px;
    border: 1px solid var(--divider);
    text-align: center;
}

.metric-name {
    font-size: 0.8em;
    color: var(--fgTransparentWeak);
    margin-bottom: 4px;
}

.metric-value {
    font-size: 1.5em;
    font-weight: bold;
    color: var(--accent);
    margin-bottom: 4px;
}

.metric-meta {
    display: flex;
    flex-direction: column;
    gap: 2px;
    font-size: 0.75em;
    color: var(--fgTransparentWeak);
}

.significant {
    color: var(--success) !important;
    font-weight: bold;
}

.presets-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: 16px;
}

.preset-card {
    background: var(--panel);
    border-radius: 8px;
    padding: 16px;
    border: 1px solid var(--divider);
    cursor: pointer;
    transition: all 0.2s ease;

    &:hover {
        border-color: var(--accent);
        background: var(--accentedBg);
    }

    h5 {
        margin: 0 0 8px 0;
        color: var(--accent);
    }

    p {
        margin: 0 0 8px 0;
        color: var(--fgTransparentWeak);
        font-size: 0.9em;
    }
}

.preset-config {
    font-size: 0.8em;
    color: var(--fg);
    font-family: monospace;
    background: var(--bg);
    padding: 8px;
    border-radius: 4px;
    border: 1px solid var(--divider);
}

.empty-state {
    text-align: center;
    padding: 40px;
    color: var(--fgTransparentWeak);

    i {
        font-size: 3em;
        margin-bottom: 16px;
        display: block;
    }
}

.actions {
    display: flex;
    gap: 12px;
    flex-wrap: wrap;
}

/* New experiment form styles */
.create-experiment-form {
    margin-bottom: 24px;
}

.experiment-form {
    margin-top: 16px;
    padding: 20px;
    background: var(--bg);
    border-radius: 8px;
    border: 1px solid var(--divider);
}

.form-grid {
    display: grid;
    gap: 16px;
    margin-bottom: 24px;
}

.form-group {
    display: flex;
    flex-direction: column;
    gap: 8px;

    label {
        font-weight: bold;
        color: var(--fg);
        font-size: 0.9em;
    }
}

.form-row {
    display: grid;
    grid-template-columns: 1fr 200px;
    gap: 16px;
    align-items: end;
}

.range-value {
    font-size: 0.9em;
    color: var(--accent);
    font-weight: bold;
    margin-left: 8px;
}

.variants-section {
    margin-bottom: 24px;

    h4 {
        margin: 0 0 16px 0;
        color: var(--accent);
    }
}

.variant-config {
    background: var(--panel);
    border-radius: 8px;
    padding: 16px;
    margin-bottom: 16px;
    border: 1px solid var(--divider);
}

.variant-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;

    h5 {
        margin: 0;
        color: var(--fg);
    }
}

.variant-form {
    display: grid;
    gap: 16px;
}

.algorithm-weights {
    h6 {
        margin: 0 0 12px 0;
        color: var(--accent);
        font-size: 0.9em;
    }
}

.weights-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 12px;
}

.weight-control {
    display: flex;
    flex-direction: column;
    gap: 4px;

    label {
        font-size: 0.8em;
        color: var(--fgTransparentWeak);
    }

    span {
        font-size: 0.8em;
        color: var(--accent);
        font-weight: bold;
        text-align: center;
    }
}

.mmr-config {
    h6 {
        margin: 0 0 12px 0;
        color: var(--accent);
        font-size: 0.9em;
    }
}

.mmr-controls {
    display: grid;
    gap: 12px;
}

.mmr-params {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 12px;
    margin-top: 12px;
}

.form-actions {
    display: flex;
    gap: 12px;
    justify-content: flex-end;
    padding-top: 16px;
    border-top: 1px solid var(--divider);
}

.active {
    background: var(--accentedBg) !important;
    color: var(--accent) !important;
}
</style>