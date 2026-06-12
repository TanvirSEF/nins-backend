import { Type, applyDecorators } from '@nestjs/common';
import {
  ApiExtraModels,
  ApiOkResponse,
  getSchemaPath,
  ApiHideProperty,
} from '@nestjs/swagger';

/** Generic pagination wrapper for Swagger schema generation */
export class PaginatedDto<T> {
  @ApiHideProperty()
  data: T[];

  @ApiHideProperty()
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

/** Reusable decorator: @ApiPaginatedResponse(User) */
export const ApiPaginatedResponse = <TModel extends Type<any>>(
  model: TModel,
) => {
  return applyDecorators(
    ApiExtraModels(PaginatedDto, model),
    ApiOkResponse({
      description: 'Successfully received paginated list',
      schema: {
        allOf: [
          {
            properties: {
              data: {
                type: 'array',
                items: { $ref: getSchemaPath(model) },
              },
              meta: {
                type: 'object',
                properties: {
                  total: { type: 'number', example: 100 },
                  page: { type: 'number', example: 1 },
                  limit: { type: 'number', example: 10 },
                  totalPages: { type: 'number', example: 10 },
                  hasNextPage: { type: 'boolean', example: true },
                  hasPrevPage: { type: 'boolean', example: false },
                },
              },
            },
          },
        ],
      },
    }),
  );
};
