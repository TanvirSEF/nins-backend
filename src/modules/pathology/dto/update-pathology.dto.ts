import { PartialType, OmitType } from '@nestjs/swagger';
import { CreatePathologyDto } from './create-pathology.dto';

export class UpdatePathologyDto extends PartialType(
  OmitType(CreatePathologyDto, ['patientId'] as const),
) {}
