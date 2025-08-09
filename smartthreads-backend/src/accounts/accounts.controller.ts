import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiTags,
  ApiOperation,
  ApiResponse,
} from "@nestjs/swagger";
import { AccountsService } from "./accounts.service";
import { LinkAccountDto } from "./dto/link-account.dto";
import { RotateCredentialsDto } from "./dto/rotate-credentials.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { UserRole } from "../entities/user.entity";
import { Account } from "../entities/account.entity";

@ApiTags("accounts")
@ApiBearerAuth()
@Controller("accounts")
@UseGuards(JwtAuthGuard, RolesGuard)
export class AccountsController {
  constructor(private readonly accountsService: AccountsService) {}

  @Post("link")
  @Roles(UserRole.ADMIN, UserRole.EDITOR)
  @ApiOperation({ summary: "Link a new Threads account" })
  @ApiResponse({
    status: 201,
    description: "Account linked successfully",
    type: Account,
  })
  @ApiResponse({
    status: 400,
    description: "Invalid credentials or validation error",
  })
  @ApiResponse({
    status: 409,
    description: "Account already linked",
  })
  async linkAccount(
    @Request() req,
    @Body() linkAccountDto: LinkAccountDto,
  ): Promise<Account> {
    return this.accountsService.linkAccount(req.user.id, linkAccountDto);
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.EDITOR, UserRole.VIEWER)
  @ApiOperation({ summary: "Get all linked accounts for the current user" })
  @ApiResponse({
    status: 200,
    description: "List of linked accounts",
    type: [Account],
  })
  async getAccounts(@Request() req): Promise<Account[]> {
    return this.accountsService.getUserAccounts(req.user.id);
  }

  @Get(":id")
  @Roles(UserRole.ADMIN, UserRole.EDITOR, UserRole.VIEWER)
  @ApiOperation({ summary: "Get a specific linked account" })
  @ApiResponse({
    status: 200,
    description: "Account details",
    type: Account,
  })
  @ApiResponse({
    status: 404,
    description: "Account not found",
  })
  async getAccount(@Request() req, @Param("id") id: string): Promise<Account> {
    return this.accountsService.getAccountById(id, req.user.id);
  }

  @Get(":id/health")
  @Roles(UserRole.ADMIN, UserRole.EDITOR)
  @ApiOperation({ summary: "Check account health status" })
  @ApiResponse({
    status: 200,
    description: "Account health status",
    schema: {
      type: "object",
      properties: {
        healthy: { type: "boolean" },
        error: { type: "string", nullable: true },
        lastChecked: { type: "string", format: "date-time" },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: "Account not found",
  })
  async checkHealth(
    @Request() req,
    @Param("id") id: string,
  ): Promise<{ healthy: boolean; error?: string; lastChecked: Date }> {
    // Verify ownership
    await this.accountsService.getAccountById(id, req.user.id);
    return this.accountsService.checkAccountHealth(id);
  }

  @Patch(":id/credentials")
  @Roles(UserRole.ADMIN, UserRole.EDITOR)
  @ApiOperation({ summary: "Rotate account credentials" })
  @ApiResponse({
    status: 200,
    description: "Credentials rotated successfully",
    type: Account,
  })
  @ApiResponse({
    status: 400,
    description: "Invalid credentials",
  })
  @ApiResponse({
    status: 404,
    description: "Account not found",
  })
  async rotateCredentials(
    @Request() req,
    @Param("id") id: string,
    @Body() rotateCredentialsDto: RotateCredentialsDto,
  ): Promise<Account> {
    return this.accountsService.rotateCredentials(
      id,
      req.user.id,
      rotateCredentialsDto,
    );
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(UserRole.ADMIN, UserRole.EDITOR)
  @ApiOperation({ summary: "Unlink a Threads account" })
  @ApiResponse({
    status: 204,
    description: "Account unlinked successfully",
  })
  @ApiResponse({
    status: 404,
    description: "Account not found",
  })
  async unlinkAccount(@Request() req, @Param("id") id: string): Promise<void> {
    await this.accountsService.unlinkAccount(id, req.user.id);
  }
}
