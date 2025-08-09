import {
  Controller,
  Get,
  Query,
  UseGuards,
  Request,
  Res,
  HttpStatus,
} from "@nestjs/common";
import { Response } from "express";
import {
  ApiBearerAuth,
  ApiTags,
  ApiOperation,
  ApiResponse,
} from "@nestjs/swagger";
import { AnalyticsService } from "./analytics.service";
import { AnalyticsQueryDto } from "./dto/analytics-query.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { UserRole } from "../entities/user.entity";
import * as fs from "fs";

@ApiTags("analytics")
@ApiBearerAuth()
@Controller("analytics")
@UseGuards(JwtAuthGuard, RolesGuard)
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get("posts")
  @Roles(UserRole.ADMIN, UserRole.EDITOR, UserRole.VIEWER)
  @ApiOperation({ summary: "Get post analytics" })
  @ApiResponse({
    status: 200,
    description: "Post analytics data",
  })
  async getPostAnalytics(@Request() req, @Query() query: AnalyticsQueryDto) {
    return this.analyticsService.getPostAnalytics(req.user.id, query);
  }

  @Get("accounts")
  @Roles(UserRole.ADMIN, UserRole.EDITOR, UserRole.VIEWER)
  @ApiOperation({ summary: "Get account analytics" })
  @ApiResponse({
    status: 200,
    description: "Account analytics data",
  })
  async getAccountAnalytics(
    @Request() req,
    @Query("accountId") accountId?: string,
    @Query("startDate") startDate?: string,
    @Query("endDate") endDate?: string,
  ) {
    return this.analyticsService.getAccountAnalytics(
      req.user.id,
      accountId,
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined,
    );
  }

  @Get("time-series")
  @Roles(UserRole.ADMIN, UserRole.EDITOR, UserRole.VIEWER)
  @ApiOperation({ summary: "Get time series analytics" })
  @ApiResponse({
    status: 200,
    description: "Time series analytics data",
  })
  async getTimeSeriesAnalytics(
    @Request() req,
    @Query() query: AnalyticsQueryDto,
  ) {
    return this.analyticsService.getTimeSeriesAnalytics(req.user.id, query);
  }

  @Get("export/csv")
  @Roles(UserRole.ADMIN, UserRole.EDITOR)
  @ApiOperation({ summary: "Export analytics to CSV" })
  @ApiResponse({
    status: 200,
    description: "CSV file download",
  })
  async exportToCSV(
    @Request() req,
    @Query() query: AnalyticsQueryDto,
    @Res() res: Response,
  ) {
    const filepath = await this.analyticsService.exportToCSV(
      req.user.id,
      query,
    );

    res.download(filepath, "analytics.csv", (err) => {
      if (err) {
        res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
          message: "Failed to download file",
        });
      }
      // Clean up temp file
      fs.unlinkSync(filepath);
    });
  }
}
