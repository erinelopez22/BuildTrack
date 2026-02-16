import { Request, Response } from 'express';
import { query, execute } from '../config/database';
import { ApiResponse } from '../dto/common.dto';

export class SettingsController {
  async getSMSSettings(req: Request, res: Response) {
    try {
      const result = await query('SELECT TOP 1 * FROM sms_settings');
      const data = result[0] || null;
      return res.json(new ApiResponse(true, data, 'SMS settings retrieved'));
    } catch (error) {
      return res.status(500).json(new ApiResponse(false, null, 'Error retrieving SMS settings', error));
    }
  }

  async upsertSMSSettings(req: Request, res: Response) {
    try {
      const payload = req.body;
      // Check existing
      const existing = await query('SELECT TOP 1 * FROM sms_settings');
      if (existing.length > 0) {
        // update
        const id = existing[0].id;
        const updateSql = `UPDATE sms_settings SET twilio_account_sid = @sid, twilio_auth_token = @token, twilio_sender_number = @sender, is_enabled = @enabled, event_rules = @event_rules, updated_at = GETUTCDATE() WHERE id = @id`;
        await execute(updateSql, {
          sid: payload.twilio_account_sid,
          token: payload.twilio_auth_token,
          sender: payload.twilio_sender_number,
          enabled: payload.is_enabled ? 1 : 0,
          event_rules: JSON.stringify(payload.event_rules || {}),
          id,
        });
        const updated = await query('SELECT * FROM sms_settings WHERE id = @id', { id });
        return res.json(new ApiResponse(true, updated[0], 'SMS settings updated'));
      } else {
        const insertSql = `INSERT INTO sms_settings (twilio_account_sid, twilio_auth_token, twilio_sender_number, is_enabled, event_rules, created_at, updated_at) VALUES (@sid, @token, @sender, @enabled, @event_rules, GETUTCDATE(), GETUTCDATE()); SELECT SCOPE_IDENTITY() as id`;
        await execute(insertSql, {
          sid: payload.twilio_account_sid,
          token: payload.twilio_auth_token,
          sender: payload.twilio_sender_number,
          enabled: payload.is_enabled ? 1 : 0,
          event_rules: JSON.stringify(payload.event_rules || {}),
        });
        const newRow = await query('SELECT TOP 1 * FROM sms_settings ORDER BY created_at DESC');
        return res.status(201).json(new ApiResponse(true, newRow[0], 'SMS settings created'));
      }
    } catch (error) {
      return res.status(500).json(new ApiResponse(false, null, 'Error saving SMS settings', error));
    }
  }
}

export const settingsController = new SettingsController();
