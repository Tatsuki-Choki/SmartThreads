import {
  IsString,
  IsEnum,
  IsInt,
  IsArray,
  ValidateNested,
  IsNotEmpty,
  Min,
  Max,
  IsOptional,
  IsBoolean,
  IsUUID,
} from "class-validator";
import { Type } from "class-transformer";
import { MatchType } from "../../entities";

export class UpdateReplyTemplateDto {
  @IsOptional()
  @IsUUID()
  id?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  text?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  weight?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateKeywordReplyDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  keyword?: string;

  @IsOptional()
  @IsEnum(MatchType)
  matchType?: MatchType;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  priority?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateReplyTemplateDto)
  replies?: UpdateReplyTemplateDto[];
}