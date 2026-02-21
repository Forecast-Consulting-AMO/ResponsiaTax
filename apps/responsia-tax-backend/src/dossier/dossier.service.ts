import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Dossier, DossierStatus } from './entities/dossier.entity';
import { CreateDossierDto } from './dto/create-dossier.dto';
import { UpdateDossierDto } from './dto/update-dossier.dto';

@Injectable()
export class DossierService {
  constructor(
    @InjectRepository(Dossier)
    private readonly dossierRepo: Repository<Dossier>,
  ) {}

  async create(dto: CreateDossierDto): Promise<Dossier> {
    const dossier = this.dossierRepo.create(dto);
    return this.dossierRepo.save(dossier);
  }

  async findAll(
    status?: DossierStatus,
    page?: number,
    limit?: number,
  ): Promise<{
    data: (Dossier & { rounds_count: number; documents_count: number })[];
    total: number;
    page: number;
    limit: number;
  }> {
    const qb = this.dossierRepo.createQueryBuilder('d')
      .leftJoin('d.rounds', 'r')
      .leftJoin('d.documents', 'doc')
      .addSelect(['d', 'r.id', 'doc.id'])
      .orderBy('d.created_at', 'DESC');

    if (status) {
      qb.where('d.status = :status', { status });
    }

    const effectivePage = page && page > 0 ? page : 1;
    const effectiveLimit = limit && limit > 0 ? Math.min(limit, 100) : 50;

    // Get total count before pagination
    const total = await qb.getCount();

    // Apply pagination
    qb.skip((effectivePage - 1) * effectiveLimit).take(effectiveLimit);

    const dossiers = await qb.getMany();

    // Add counts as virtual properties
    const data = dossiers.map((d) => ({
      ...d,
      rounds_count: d.rounds?.length ?? 0,
      documents_count: d.documents?.length ?? 0,
    })) as (Dossier & { rounds_count: number; documents_count: number })[];

    return { data, total, page: effectivePage, limit: effectiveLimit };
  }

  async findOne(id: string): Promise<Dossier> {
    const dossier = await this.dossierRepo.findOne({
      where: { id },
      relations: ['rounds', 'documents'],
    });
    if (!dossier) {
      throw new NotFoundException(`Dossier ${id} not found`);
    }
    return dossier;
  }

  async update(id: string, dto: UpdateDossierDto): Promise<Dossier> {
    const dossier = await this.findOne(id);
    Object.assign(dossier, dto);
    return this.dossierRepo.save(dossier);
  }

  async remove(id: string): Promise<void> {
    const dossier = await this.findOne(id);
    await this.dossierRepo.remove(dossier);
  }
}
