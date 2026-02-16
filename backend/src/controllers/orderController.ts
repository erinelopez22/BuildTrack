import { Request, Response } from 'express';
import { orderService } from '../services/orderService';
import { CreateOrderDTO, UpdateOrderDTO, ApproveOrderDTO, RejectOrderDTO } from '../dto/order.dto';
import { ApiResponse } from '../dto/common.dto';

export class OrderController {
  async getOrder(req: Request, res: Response) {
    try {
      const { orderId } = req.params;
      const order = await orderService.getOrderById(orderId);

      if (!order) {
        return res.status(404).json(new ApiResponse(false, null, 'Order not found'));
      }

      return res.json(new ApiResponse(true, order, 'Order retrieved successfully'));
    } catch (error) {
      return res.status(500).json(new ApiResponse(false, null, 'Error retrieving order', error));
    }
  }

  async getOrdersByProject(req: Request, res: Response) {
    try {
      const { projectId } = req.params;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const skip = (page - 1) * limit;

      const { orders, total } = await orderService.getOrdersByProject(projectId, skip, limit);

      return res.json(new ApiResponse(true, {
        orders,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      }, 'Orders retrieved successfully'));
    } catch (error) {
      return res.status(500).json(new ApiResponse(false, null, 'Error retrieving orders', error));
    }
  }

  async createOrder(req: Request, res: Response) {
    try {
      const dto: CreateOrderDTO = req.body;
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json(new ApiResponse(false, null, 'Unauthorized'));
      }

      const order = await orderService.createOrder(dto, userId);
      return res.status(201).json(new ApiResponse(true, order, 'Order created successfully'));
    } catch (error) {
      return res.status(500).json(new ApiResponse(false, null, 'Error creating order', error));
    }
  }

  async updateOrder(req: Request, res: Response) {
    try {
      const { orderId } = req.params;
      const dto: UpdateOrderDTO = req.body;

      const order = await orderService.updateOrder(orderId, dto);
      return res.json(new ApiResponse(true, order, 'Order updated successfully'));
    } catch (error) {
      return res.status(500).json(new ApiResponse(false, null, 'Error updating order', error));
    }
  }

  async approveOrder(req: Request, res: Response) {
    try {
      const { orderId } = req.params;
      const dto: ApproveOrderDTO = req.body;

      const order = await orderService.approveOrder(orderId, dto);
      return res.json(new ApiResponse(true, order, 'Order approved successfully'));
    } catch (error) {
      return res.status(500).json(new ApiResponse(false, null, 'Error approving order', error));
    }
  }

  async rejectOrder(req: Request, res: Response) {
    try {
      const { orderId } = req.params;
      const dto: RejectOrderDTO = req.body;

      const order = await orderService.rejectOrder(orderId, dto);
      return res.json(new ApiResponse(true, order, 'Order rejected successfully'));
    } catch (error) {
      return res.status(500).json(new ApiResponse(false, null, 'Error rejecting order', error));
    }
  }
}

export const orderController = new OrderController();
