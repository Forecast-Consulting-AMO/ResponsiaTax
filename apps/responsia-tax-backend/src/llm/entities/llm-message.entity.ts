import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Question } from '../../question/entities/question.entity';

export enum LlmRole {
  SYSTEM = 'system',
  USER = 'user',
  ASSISTANT = 'assistant',
}

@Entity('llm_messages')
export class LlmMessage {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'question_id' })
  question_id!: string;

  @Column({
    type: 'enum',
    enum: LlmRole,
  })
  role!: LlmRole;

  @Column({ type: 'text' })
  content!: string;

  @Column({ type: 'varchar', length: 100 })
  model!: string;

  @Column({ type: 'int', name: 'tokens_in', nullable: true })
  tokens_in!: number | null;

  @Column({ type: 'int', name: 'tokens_out', nullable: true })
  tokens_out!: number | null;

  @CreateDateColumn({ name: 'created_at' })
  created_at!: Date;

  @ManyToOne(() => Question, (question) => question.messages, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'question_id' })
  question!: Question;
}
