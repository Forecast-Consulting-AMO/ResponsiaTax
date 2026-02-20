import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Round } from './entities/round.entity';
import { RoundService } from './round.service';
import { RoundController } from './round.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Round])],
  controllers: [RoundController],
  providers: [RoundService],
  exports: [RoundService],
})
export class RoundModule {}
