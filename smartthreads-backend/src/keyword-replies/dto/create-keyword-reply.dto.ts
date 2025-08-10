import {
  IsString,
  IsEnum,
  IsInt,
  IsUUID,
  IsArray,
  ValidateNested,
  IsNotEmpty,
  Min,
  Max,
  ArrayMinSize,
} from "class-validator";
import { Type } from "class-transformer";
import { MatchType } from "../../entities";

export class CreateReplyTemplateDto {
  @IsString()
  @IsNotEmpty()
  text: string;

  @IsInt()
  @Min(1)
  @Max(100)
  weight: number;
}

export class CreateKeywordReplyDto {
  @IsString()
  @IsNotEmpty()
  keyword: string;

  @IsEnum(MatchType)
  matchType: MatchType;

  @IsInt()
  @Min(1)
  @Max(10)
  priority: number;

  @IsUUID()
  accountId: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateReplyTemplateDto)
  replies: CreateReplyTemplateDto[];
}