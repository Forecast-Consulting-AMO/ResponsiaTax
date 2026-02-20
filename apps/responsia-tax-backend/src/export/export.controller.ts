import {
  Controller,
  Post,
  Param,
  Res,
  ParseUUIDPipe,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam, ApiProduces } from '@nestjs/swagger';
import * as express from 'express';
import { ExportService } from './export.service';

@ApiTags('Export')
@Controller({ version: '1' })
export class ExportController {
  private readonly logger = new Logger(ExportController.name);

  constructor(private readonly exportService: ExportService) {}

  @Post('rounds/:roundId/export')
  @ApiOperation({ summary: 'Export a round as a DOCX document' })
  @ApiParam({ name: 'roundId', type: 'string', format: 'uuid' })
  @ApiProduces('application/vnd.openxmlformats-officedocument.wordprocessingml.document')
  async exportRound(
    @Param('roundId', ParseUUIDPipe) roundId: string,
    @Res() res: express.Response,
  ) {
    this.logger.log(`Exporting round ${roundId} as DOCX`);

    const buffer = await this.exportService.exportRound(roundId);

    const filename = `reponse_round_${roundId.slice(0, 8)}.docx`;

    res.set({
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': buffer.length.toString(),
    });

    res.send(buffer);
  }
}
