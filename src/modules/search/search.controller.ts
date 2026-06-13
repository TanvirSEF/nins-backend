import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { SearchService } from './search.service';
import { SearchDto } from './dto/search.dto';
import { Roles } from '../../common/decorators';
import { Role } from '../user/user.schema';

@ApiTags('search')
@ApiBearerAuth('JWT-auth')
@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  @Roles(Role.SUPER_ADMIN, Role.HOSPITAL_STAFF, Role.DOCTOR)
  @ApiOperation({
    summary: 'Global search across patients, doctors, and appointments',
  })
  @ApiResponse({ status: 200, description: 'Search results' })
  @ApiResponse({ status: 400, description: 'Query too short (min 2 chars)' })
  search(@Query() dto: SearchDto) {
    return this.searchService.search(dto);
  }
}
