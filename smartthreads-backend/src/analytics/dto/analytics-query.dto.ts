import {
  IsOptional,
  IsDateString,
  IsEnum,
  IsUUID,
  IsInt,
  Min,
  Max,
} from "class-validator";
import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";

export enum AnalyticsPeriod {
  HOUR = "hour",
  DAY = "day",
  WEEK = "week",
  MONTH = "month",
}

export enum MetricType {
  VIEWS = "views",
  LIKES = "likes",
  REPLIES = "replies",
  REPOSTS = "reposts",
  QUOTES = "quotes",
  ENGAGEMENT_RATE = "engagement_rate",
}

export class AnalyticsQueryDto {
  @ApiPropertyOptional({
    description: "Account ID to filter by",
  })
  @IsOptional()
  @IsUUID()
  accountId?: string;

  @ApiPropertyOptional({
    description: "Start date (ISO 8601)",
  })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({
    description: "End date (ISO 8601)",
  })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({
    enum: AnalyticsPeriod,
    description: "Aggregation period",
  })
  @IsOptional()
  @IsEnum(AnalyticsPeriod)
  period?: AnalyticsPeriod = AnalyticsPeriod.DAY;

  @ApiPropertyOptional({
    enum: MetricType,
    isArray: true,
    description: "Metrics to include",
  })
  @IsOptional()
  @IsEnum(MetricType, { each: true })
  metrics?: MetricType[] = [
    MetricType.VIEWS,
    MetricType.LIKES,
    MetricType.ENGAGEMENT_RATE,
  ];

  @ApiPropertyOptional({
    description: "Limit results",
    minimum: 1,
    maximum: 1000,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000)
  limit?: number = 100;
}
