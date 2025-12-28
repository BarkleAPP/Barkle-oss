import { PrimaryColumn, Entity, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';
import { id } from '../id.js';

/**
 * Persistent storage for user algorithm learnings
 * Ensures personalized recommendations survive server restarts
 */
@Entity()
@Index(['userId'], { unique: true })
export class UserAlgorithmPreferences {
    @PrimaryColumn(id())
    public id: string;

    @Index()
    @Column('varchar', {
        length: 32,
        comment: 'The ID of the user these preferences belong to.',
    })
    public userId: string;

    // Topic affinities (what topics the user engages with)
    @Column('jsonb', {
        default: {},
        comment: 'Topic engagement scores: { topicName: score }',
    })
    public topicAffinities: Record<string, number>;

    // Author affinities (which authors the user engages with)
    @Column('jsonb', {
        default: {},
        comment: 'Author engagement scores: { authorId: score }',
    })
    public authorAffinities: Record<string, number>;

    // Engagement patterns
    @Column('jsonb', {
        default: {},
        comment: 'User engagement patterns: { engagementRate, preferredContentLength, etc }',
    })
    public engagementPatterns: Record<string, any>;

    // Temporal patterns (when user is active)
    @Column('jsonb', {
        default: {},
        comment: 'Temporal engagement patterns: { peakHours: [], preferredDays: [] }',
    })
    public temporalPatterns: Record<string, any>;

    // Contact-based features for social graph
    @Column('jsonb', {
        default: {},
        comment: 'Contact match IDs and relationship metadata',
    })
    public contactMatches: Record<string, any>;

    // Second-degree connections
    @Column('jsonb', {
        default: {},
        comment: 'Second-degree connections with mutual contact counts',
    })
    public secondDegreeConnections: Record<string, number>;

    // Embedding vectors for ML model
    @Column('jsonb', {
        nullable: true,
        comment: 'User embedding vector for similarity calculations',
    })
    public userEmbedding: number[] | null;

    // Model version for migration support
    @Column('integer', {
        default: 1,
        comment: 'Algorithm model version for backward compatibility',
    })
    public modelVersion: number;

    // Statistics
    @Column('integer', {
        default: 0,
        comment: 'Total number of signals processed',
    })
    public totalSignals: number;

    @Column('float', {
        default: 0,
        comment: 'Overall engagement rate (0-1)',
    })
    public engagementRate: number;

    @CreateDateColumn()
    public createdAt: Date;

    @UpdateDateColumn()
    public updatedAt: Date;

    @Column('timestamp', {
        nullable: true,
        comment: 'Last time algorithm learnings were updated',
    })
    public lastLearningUpdate: Date | null;
}
