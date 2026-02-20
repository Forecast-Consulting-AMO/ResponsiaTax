import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Question } from './entities/question.entity';
import { CreateQuestionDto } from './dto/create-question.dto';
import { UpdateQuestionDto } from './dto/update-question.dto';

@Injectable()
export class QuestionService {
  constructor(
    @InjectRepository(Question)
    private readonly questionRepo: Repository<Question>,
  ) {}

  async create(roundId: string, dto: CreateQuestionDto): Promise<Question> {
    const question = this.questionRepo.create({
      ...dto,
      round_id: roundId,
    });
    return this.questionRepo.save(question);
  }

  async findAllByRound(roundId: string): Promise<Question[]> {
    return this.questionRepo.find({
      where: { round_id: roundId },
      order: { question_number: 'ASC' },
    });
  }

  async findOne(id: string): Promise<Question> {
    const question = await this.questionRepo.findOne({
      where: { id },
      relations: ['messages'],
    });
    if (!question) {
      throw new NotFoundException(`Question ${id} not found`);
    }
    return question;
  }

  async update(id: string, dto: UpdateQuestionDto): Promise<Question> {
    const question = await this.findOne(id);
    Object.assign(question, dto);
    return this.questionRepo.save(question);
  }

  async createBulk(roundId: string, questions: CreateQuestionDto[]): Promise<Question[]> {
    const entities = questions.map((dto) =>
      this.questionRepo.create({
        ...dto,
        round_id: roundId,
      }),
    );
    return this.questionRepo.save(entities);
  }
}
