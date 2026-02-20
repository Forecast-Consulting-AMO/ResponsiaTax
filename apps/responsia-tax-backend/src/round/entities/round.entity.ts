import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { Dossier } from '../../dossier/entities/dossier.entity';
import { Question } from '../../question/entities/question.entity';
import { Document } from '../../document/entities/document.entity';

export enum RoundStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  RESPONDED = 'responded',
  CLOSED = 'closed',
}

@Entity('rounds')
export class Round {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'dossier_id' })
  dossier_id!: string;

  @Column({ type: 'int', name: 'round_number' })
  round_number!: number;

  @Column({ type: 'date', name: 'received_date', nullable: true })
  received_date!: string | null;

  @Column({ type: 'date', nullable: true })
  deadline!: string | null;

  @Column({
    type: 'enum',
    enum: RoundStatus,
    default: RoundStatus.PENDING,
  })
  status!: RoundStatus;

  @CreateDateColumn({ name: 'created_at' })
  created_at!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updated_at!: Date;

  @ManyToOne(() => Dossier, (dossier) => dossier.rounds, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'dossier_id' })
  dossier!: Dossier;

  @OneToMany(() => Question, (question) => question.round)
  questions!: Question[];

  @OneToMany(() => Document, (doc) => doc.round)
  documents!: Document[];
}
