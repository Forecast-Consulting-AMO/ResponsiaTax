import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Round } from './entities/round.entity';
import { CreateRoundDto } from './dto/create-round.dto';
import { UpdateRoundDto } from './dto/update-round.dto';

@Injectable()
export class RoundService {
  constructor(
    @InjectRepository(Round)
    private readonly roundRepo: Repository<Round>,
  ) {}

  async create(dossierId: string, dto: CreateRoundDto): Promise<Round> {
    const round = this.roundRepo.create({
      ...dto,
      dossier_id: dossierId,
    });
    return this.roundRepo.save(round);
  }

  async findAllByDossier(dossierId: string): Promise<Round[]> {
    return this.roundRepo.find({
      where: { dossier_id: dossierId },
      order: { round_number: 'ASC' },
    });
  }

  async findOne(id: string): Promise<Round> {
    const round = await this.roundRepo.findOne({
      where: { id },
      relations: ['questions', 'documents'],
    });
    if (!round) {
      throw new NotFoundException(`Round ${id} not found`);
    }
    return round;
  }

  async update(id: string, dto: UpdateRoundDto): Promise<Round> {
    const round = await this.findOne(id);
    Object.assign(round, dto);
    return this.roundRepo.save(round);
  }
}
