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
import { Round } from '../../round/entities/round.entity';
import { LlmMessage } from '../../llm/entities/llm-message.entity';

export enum QuestionStatus {
  PENDING = 'pending',
  DRAFTING = 'drafting',
  REVIEWED = 'reviewed',
  APPROVED = 'approved',
}

@Entity('questions')
export class Question {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'round_id' })
  round_id!: string;

  @Column({ type: 'int', name: 'question_number' })
  question_number!: number;

  @Column({ type: 'text', name: 'question_text' })
  question_text!: string;

  @Column({ type: 'text', name: 'response_text', nullable: true })
  response_text!: string | null;

  @Column({
    type: 'enum',
    enum: QuestionStatus,
    default: QuestionStatus.PENDING,
  })
  status!: QuestionStatus;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  created_at!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updated_at!: Date;

  @ManyToOne(() => Round, (round) => round.questions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'round_id' })
  round!: Round;

  @OneToMany(() => LlmMessage, (msg) => msg.question)
  messages!: LlmMessage[];
}
