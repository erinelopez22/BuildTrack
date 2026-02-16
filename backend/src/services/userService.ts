import { query, execute } from '../config/database';
import { CreateUserDTO, UpdateUserDTO, UserResponseDTO } from '../dto/user.dto';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

export class UserService {
  async getUserById(userId: string): Promise<UserResponseDTO | null> {
    const sql = `
      SELECT 
        u.id, u.email, u.full_name, u.phone, u.avatar_url, 
        u.sms_opt_in, u.is_active, u.created_at, u.updated_at
      FROM users u
      WHERE u.id = @userId
    `;

    const result = await query(sql, { userId });
    if (result.length === 0) return null;

    const user = result[0] as any;
    const roles = await this.getUserRoles(userId);

    return {
      id: user.id,
      email: user.email,
      full_name: user.full_name,
      phone: user.phone,
      avatar_url: user.avatar_url,
      sms_opt_in: user.sms_opt_in,
      is_active: user.is_active,
      created_at: user.created_at,
      updated_at: user.updated_at,
      roles,
    };
  }

  async getUserByEmail(email: string): Promise<UserResponseDTO | null> {
    const sql = `
      SELECT 
        u.id, u.email, u.full_name, u.phone, u.avatar_url, 
        u.sms_opt_in, u.is_active, u.created_at, u.updated_at
      FROM users u
      WHERE u.email = @email
    `;

    const result = await query(sql, { email });
    if (result.length === 0) return null;

    const user = result[0] as any;
    const roles = await this.getUserRoles(user.id);

    return {
      id: user.id,
      email: user.email,
      full_name: user.full_name,
      phone: user.phone,
      avatar_url: user.avatar_url,
      sms_opt_in: user.sms_opt_in,
      is_active: user.is_active,
      created_at: user.created_at,
      updated_at: user.updated_at,
      roles,
    };
  }

  async getAllUsers(skip: number = 0, take: number = 10): Promise<{ users: UserResponseDTO[], total: number }> {
    const countSql = 'SELECT COUNT(*) as total FROM users';
    const countResult = await query(countSql);
    const total = (countResult[0] as any).total;

    const sql = `
      SELECT 
        id, email, full_name, phone, avatar_url, 
        sms_opt_in, is_active, created_at, updated_at
      FROM users
      ORDER BY created_at DESC
      OFFSET @skip ROWS FETCH NEXT @take ROWS ONLY
    `;

    const users = await query(sql, { skip, take });
    const usersWithRoles = await Promise.all(
      users.map(async (u: any) => {
        const roles = await this.getUserRoles(u.id);
        return { ...u, roles };
      })
    );

    return { users: usersWithRoles, total };
  }

  async createUser(dto: CreateUserDTO, createdBy: string): Promise<UserResponseDTO> {
    const userId = uuidv4();
    const hashedPassword = await bcrypt.hash(dto.password, 10);

    const insertUserSql = `
      INSERT INTO users (id, email, full_name, phone, password_hash, is_active, created_at, updated_at)
      VALUES (@id, @email, @full_name, @phone, @passwordHash, 1, GETUTCDATE(), GETUTCDATE())
    `;

    await execute(insertUserSql, {
      id: userId,
      email: dto.email,
      full_name: dto.full_name,
      phone: dto.phone || null,
      passwordHash: hashedPassword,
    });

    // Assign roles
    if (dto.roles && dto.roles.length > 0) {
      const roleAssignSql = `
        INSERT INTO user_roles (id, user_id, role, created_at, created_by)
        VALUES (@id, @userId, @role, GETUTCDATE(), @createdBy)
      `;

      for (const role of dto.roles) {
        await execute(roleAssignSql, {
          id: uuidv4(),
          userId,
          role,
          createdBy,
        });
      }
    }

    return this.getUserById(userId) as Promise<UserResponseDTO>;
  }

  async updateUser(userId: string, dto: UpdateUserDTO): Promise<UserResponseDTO> {
    let sql = 'UPDATE users SET updated_at = GETUTCDATE()';
    const params: Record<string, any> = { userId };

    if (dto.full_name !== undefined) {
      sql += ', full_name = @full_name';
      params.full_name = dto.full_name;
    }
    if (dto.phone !== undefined) {
      sql += ', phone = @phone';
      params.phone = dto.phone;
    }
    if (dto.avatar_url !== undefined) {
      sql += ', avatar_url = @avatar_url';
      params.avatar_url = dto.avatar_url;
    }
    if (dto.sms_opt_in !== undefined) {
      sql += ', sms_opt_in = @sms_opt_in';
      params.sms_opt_in = dto.sms_opt_in;
    }

    sql += ' WHERE id = @userId';
    await execute(sql, params);

    return this.getUserById(userId) as Promise<UserResponseDTO>;
  }

  async deactivateUser(userId: string): Promise<void> {
    const sql = 'UPDATE users SET is_active = 0, updated_at = GETUTCDATE() WHERE id = @userId';
    await execute(sql, { userId });
  }

  async authenticate(email: string, password: string): Promise<{ user: any | null } | null> {
    const sql = `
      SELECT u.id, u.email, u.full_name, u.phone, u.avatar_url, u.sms_opt_in, u.is_active, u.password_hash, u.created_at, u.updated_at
      FROM users u
      WHERE u.email = @email
    `;

    const result = await query(sql, { email });
    if (result.length === 0) return null;

    const row = result[0] as any;
    const passwordHash = row.password_hash;
    const match = await bcrypt.compare(password, passwordHash);
    if (!match) return null;

    const roles = await this.getUserRoles(row.id);

    const user = {
      id: row.id,
      email: row.email,
      full_name: row.full_name,
      phone: row.phone,
      avatar_url: row.avatar_url,
      sms_opt_in: row.sms_opt_in,
      is_active: row.is_active,
      created_at: row.created_at,
      updated_at: row.updated_at,
      roles,
    };

    return { user };
  }

  private async getUserRoles(userId: string): Promise<string[]> {
    const sql = 'SELECT role FROM user_roles WHERE user_id = @userId';
    const results = await query(sql, { userId });
    return results.map((r: any) => r.role);
  }
}

export const userService = new UserService();
