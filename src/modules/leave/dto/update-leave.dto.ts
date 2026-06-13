import { PartialType, OmitType } from '@nestjs/swagger';
import { CreateLeaveDto } from './create-leave.dto';

export class UpdateLeaveDto extends PartialType(
  OmitType(CreateLeaveDto, [] as const),
) {}
