import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { Round } from '../../round/entities/round.entity';
import { Document } from '../../document/entities/document.entity';

export enum DossierStatus {
  OPEN = 'open',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  CLOSED = 'closed',
}

@Entity('dossiers')
export class Dossier {
  @PrimaryColumn({ type: 'uuid', default: () => 'gen_random_uuid()' })
  id!: string;

  @Column({ type: 'varchar', length: 255 })
  name!: string;

  @Column({ type: 'varchar', length: 255, name: 'company_name' })
  company_name!: string;

  @Column({ type: 'varchar', length: 100, name: 'company_number', nullable: true })
  company_number!: string | null;

  @Column({ type: 'varchar', length: 100, name: 'tax_type' })
  tax_type!: string;

  @Column({ type: 'varchar', length: 20, name: 'tax_year' })
  tax_year!: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  reference!: string | null;

  @Column({ type: 'varchar', length: 255, name: 'controller_name', nullable: true })
  controller_name!: string | null;

  @Column({ type: 'varchar', length: 255, name: 'controller_email', nullable: true })
  controller_email!: string | null;

  @Column({
    type: 'enum',
    enum: DossierStatus,
    default: DossierStatus.OPEN,
  })
  status!: DossierStatus;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @Column({ type: 'text', name: 'system_prompt', nullable: true })
  system_prompt!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  created_at!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updated_at!: Date;

  @OneToMany(() => Round, (round) => round.dossier)
  rounds!: Round[];

  @OneToMany(() => Document, (doc) => doc.dossier)
  documents!: Document[];
}
