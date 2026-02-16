import { Request, Response } from 'express';
import { userService } from '../services/userService';
import { CreateUserDTO, UpdateUserDTO, LoginDTO, ChangePasswordDTO } from '../dto/user.dto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { env } from '../config/environment';
import { ApiResponse, PaginationQuery } from '../dto/common.dto';

export class UserController {
  async getProfile(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json(new ApiResponse(false, null, 'Unauthorized'));
      }

      const user = await userService.getUserById(userId);
      if (!user) {
        return res.status(404).json(new ApiResponse(false, null, 'User not found'));
      }

      return res.json(new ApiResponse(true, user, 'Profile retrieved successfully'));
    } catch (error) {
      return res.status(500).json(new ApiResponse(false, null, 'Error retrieving profile', error));
    }
  }

  async getAllUsers(req: Request, res: Response) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const skip = (page - 1) * limit;

      const { users, total } = await userService.getAllUsers(skip, limit);

      return res.json(new ApiResponse(true, {
        users,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      }, 'Users retrieved successfully'));
    } catch (error) {
      return res.status(500).json(new ApiResponse(false, null, 'Error retrieving users', error));
    }
  }

  async createUser(req: Request, res: Response) {
    try {
      const dto: CreateUserDTO = req.body;
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json(new ApiResponse(false, null, 'Unauthorized'));
      }

      // Check if user already exists
      const existingUser = await userService.getUserByEmail(dto.email);
      if (existingUser) {
        return res.status(400).json(new ApiResponse(false, null, 'User with this email already exists'));
      }

      const newUser = await userService.createUser(dto, userId);
      return res.status(201).json(new ApiResponse(true, newUser, 'User created successfully'));
    } catch (error) {
      return res.status(500).json(new ApiResponse(false, null, 'Error creating user', error));
    }
  }

  async updateProfile(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json(new ApiResponse(false, null, 'Unauthorized'));
      }

      const dto: UpdateUserDTO = req.body;
      const updatedUser = await userService.updateUser(userId, dto);

      return res.json(new ApiResponse(true, updatedUser, 'Profile updated successfully'));
    } catch (error) {
      return res.status(500).json(new ApiResponse(false, null, 'Error updating profile', error));
    }
  }

  async changePassword(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json(new ApiResponse(false, null, 'Unauthorized'));
      }

      const dto: ChangePasswordDTO = req.body;

      if (dto.new_password !== dto.confirm_password) {
        return res.status(400).json(new ApiResponse(false, null, 'Passwords do not match'));
      }

      // Verify current password
      // TODO: Implement password verification

      return res.json(new ApiResponse(true, null, 'Password changed successfully'));
    } catch (error) {
      return res.status(500).json(new ApiResponse(false, null, 'Error changing password', error));
    }
  }

  async deactivateUser(req: Request, res: Response) {
    try {
      const { userId } = req.params;
      await userService.deactivateUser(userId);

      return res.json(new ApiResponse(true, null, 'User deactivated successfully'));
    } catch (error) {
      return res.status(500).json(new ApiResponse(false, null, 'Error deactivating user', error));
    }
  }
}

export const userController = new UserController();
