import { PrimaryColumn, Entity, Column, CreateDateColumn, Index, ManyToOne, JoinColumn } from 'typeorm';
import { id } from '../id.js';
import { User } from './user.js';

/**
 * Track degrees of separation between users through contacts
 * Builds a "spider web" social graph for recommendations
 */
@Entity()
@Index(['sourceUserId', 'targetUserId'], { unique: true })
@Index(['sourceUserId', 'degreeOfSeparation'])
@Index(['targetUserId'])
export class ContactDegreeOfSeparation {
    @PrimaryColumn(id())
    public id: string;

    @Index()
    @Column('varchar', {
        length: 32,
        comment: 'The source user ID (starting point)',
    })
    public sourceUserId: string;

    @Index()
    @Column('varchar', {
        length: 32,
        comment: 'The target user ID (end point)',
    })
    public targetUserId: string;

    @Column('integer', {
        comment: 'Degree of separation (1 = direct contact, 2 = friend of friend, etc.)',
    })
    public degreeOfSeparation: number;

    @Column('jsonb', {
        default: [],
        comment: 'Path of user IDs connecting source to target',
    })
    public connectionPath: string[];

    @Column('integer', {
        default: 1,
        comment: 'Number of different paths connecting these users',
    })
    public pathCount: number;

    @Column('float', {
        default: 1.0,
        comment: 'Connection strength (higher = stronger connection)',
    })
    public connectionStrength: number;

    @Column('jsonb', {
        nullable: true,
        comment: 'Metadata about the connection (shared contacts, groups, etc.)',
    })
    public metadata: Record<string, any> | null;

    @CreateDateColumn()
    public createdAt: Date;

    @Column('timestamp', {
        nullable: true,
        comment: 'Last time this connection was verified/updated',
    })
    public lastVerified: Date | null;

    @ManyToOne(() => User, {
        onDelete: 'CASCADE',
    })
    @JoinColumn()
    public sourceUser: User | null;

    @ManyToOne(() => User, {
        onDelete: 'CASCADE',
    })
    @JoinColumn()
    public targetUser: User | null;
}
