import { Entity, PrimaryColumn, CreateDateColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { QuickBark } from './quick-bark';
import { User } from './user';

@Entity('quick_bark_view')
export class QuickBarkView {
    @PrimaryColumn({ type: 'varchar', length: 32 })
    id: string;

    @CreateDateColumn({ type: 'timestamp with time zone' })
    createdAt: Date;

    @Column({ type: 'varchar', length: 32 })
    quickBarkId: string;

    @Column({ type: 'varchar', length: 32 })
    userId: string;

    @ManyToOne(() => QuickBark)
    @JoinColumn({ name: 'quickBarkId' })
    quickBark: QuickBark;

    @ManyToOne(() => User)
    @JoinColumn({ name: 'userId' })
    user: User;
}
