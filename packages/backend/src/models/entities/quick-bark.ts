import { Entity, PrimaryColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { User } from './user';
import { Note } from './note';
import { DriveFile } from './drive-file';

@Entity('quick_bark')
export class QuickBark {
    @PrimaryColumn({ type: 'varchar', length: 32 })
    id: string;

    @CreateDateColumn({ type: 'timestamp with time zone' })
    createdAt: Date;

    @Column({ type: 'varchar', length: 32 })
    userId: string;

    @Column({ type: 'text', nullable: true })
    content: string;

    @Column({ type: 'varchar', length: 16 })
    type: 'text' | 'image' | 'video' | 'gif';

    @Column({ type: 'timestamp with time zone' })
    expiresAt: Date;

    @Column({ type: 'varchar', length: 32, nullable: true })
    sharedNoteId: string;

    @Column({ type: 'varchar', length: 32, nullable: true })
    fileId: string;

    @ManyToOne(() => User)
    @JoinColumn({ name: 'userId' })
    user: User;

    @ManyToOne(() => Note)
    @JoinColumn({ name: 'sharedNoteId' })
    sharedNote: Note;

    @ManyToOne(() => DriveFile)
    @JoinColumn({ name: 'fileId' })
    file: DriveFile;
}
