import { Entity, PrimaryColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { User } from './user.js';

@Entity('user_music_integration')
@Index(['userId', 'service'], { unique: true })
export class UserMusicIntegration {
    @PrimaryColumn({ type: 'varchar', length: 32 })
    id: string;

    @CreateDateColumn()
    createdAt: Date;

    @Column({ type: 'varchar', length: 32 })
    @Index()
    userId: string;

    @ManyToOne(() => User, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'userId' })
    user: User;

    @Column({ type: 'varchar', length: 32 })
    service: 'spotify' | 'lastfm';

    @Column({ type: 'varchar', length: 256 })
    externalUserId: string;

    @Column({ type: 'varchar', length: 256 })
    username: string;

    @Column({ type: 'text', nullable: true })
    accessToken: string | null;

    @Column({ type: 'text', nullable: true })
    refreshToken: string | null;

    @Column({ type: 'timestamp with time zone', nullable: true })
    expiresAt: Date | null;
}
