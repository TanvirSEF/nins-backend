import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { DepartmentService } from './department.service';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { UpdateDepartmentDto } from './dto/update-department.dto';
import { DepartmentDocument } from './department.schema';
import { Department } from './department.schema';
import { PaginationDto, ApiPaginatedResponse } from '../../common/dto';
import { Public, Roles } from '../../common/decorators';
import { Role } from '../user/user.schema';

@ApiTags('departments')
@ApiBearerAuth('JWT-auth')
@Controller('departments')
export class DepartmentController {
  constructor(private readonly departmentService: DepartmentService) {}

  @Post()
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Create a new department (SUPER_ADMIN only)' })
  @ApiResponse({ status: 201, description: 'Department created', type: Department })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  create(@Body() dto: CreateDepartmentDto): Promise<DepartmentDocument> {
    return this.departmentService.create(dto);
  }

  @Get()
  @Public()
  @ApiOperation({ summary: 'Get all departments (paginated)' })
  @ApiPaginatedResponse(Department)
  @ApiResponse({ status: 200, description: 'Paginated list of departments' })
  findAll(@Query() pagination: PaginationDto) {
    return this.departmentService.findAll(pagination);
  }

  @Get(':id')
  @Public()
  @ApiOperation({ summary: 'Get a department by ID' })
  @ApiParam({ name: 'id', description: 'MongoDB ObjectId', type: String })
  @ApiResponse({ status: 200, description: 'Department found', type: Department })
  @ApiResponse({ status: 404, description: 'Department not found' })
  findOne(@Param('id') id: string): Promise<DepartmentDocument> {
    return this.departmentService.findOne(id);
  }

  @Patch(':id')
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Update a department (SUPER_ADMIN only)' })
  @ApiParam({ name: 'id', description: 'MongoDB ObjectId', type: String })
  @ApiResponse({ status: 200, description: 'Department updated', type: Department })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  @ApiResponse({ status: 404, description: 'Department not found' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateDepartmentDto,
  ): Promise<DepartmentDocument> {
    return this.departmentService.update(id, dto);
  }

  @Delete(':id')
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Delete a department (SUPER_ADMIN only)' })
  @ApiParam({ name: 'id', description: 'MongoDB ObjectId', type: String })
  @ApiResponse({ status: 200, description: 'Department deleted', type: Department })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  @ApiResponse({ status: 404, description: 'Department not found' })
  remove(@Param('id') id: string): Promise<DepartmentDocument> {
    return this.departmentService.remove(id);
  }
}
