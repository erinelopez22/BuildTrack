using System.Text.Json;
using BuildTrack.API.Data;
using BuildTrack.API.DTOs.Tracking;
using BuildTrack.API.Models.Entities;
using BuildTrack.API.Services.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace BuildTrack.API.Services.Implementations;

public class TrackingService(AppDbContext db) : ITrackingService
{
    public async Task<List<TrackingAssignmentDto>> GetAssignmentsAsync(Guid orderId)
    {
        var assignments = await db.OrderTrackingAssignments
            .Include(a => a.Driver)
            .Include(a => a.Creator)
            .Include(a => a.Materials).ThenInclude(m => m.OrderItem).ThenInclude(oi => oi.Sku)
            .Where(a => a.OrderId == orderId)
            .OrderBy(a => a.CreatedAt)
            .ToListAsync();

        return assignments.Select(Map).ToList();
    }

    public async Task<List<TrackingAssignmentDto>> SaveAssignmentsAsync(
        Guid orderId, SaveTrackingRequest request, Guid userId)
    {
        // Load existing assignments for this order
        var existing = await db.OrderTrackingAssignments
            .Include(a => a.Materials)
            .Where(a => a.OrderId == orderId)
            .ToListAsync();

        var existingByDriver = existing.ToDictionary(a => a.DriverUserId);

        foreach (var item in request.Assignments)
        {
            var evidenceJson = item.Evidence.Count > 0
                ? JsonSerializer.Serialize(item.Evidence)
                : null;

            if (existingByDriver.TryGetValue(item.DriverUserId, out var assignment))
            {
                // Update existing
                assignment.PlateNumber = item.PlateNumber;
                assignment.TrackingReference = item.TrackingReference;
                assignment.Notes = item.Notes;
                assignment.EvidenceJson = evidenceJson;

                // Replace materials: remove old ones, add new ones
                var oldMaterials = assignment.Materials.ToList();
                db.OrderTrackingMaterials.RemoveRange(oldMaterials);
                foreach (var m in item.Materials)
                {
                    db.OrderTrackingMaterials.Add(new OrderTrackingMaterial
                    {
                        AssignmentId = assignment.Id,
                        OrderItemId = m.OrderItemId,
                        AssignedQuantity = m.AssignedQuantity,
                    });
                }
            }
            else
            {
                // Create new assignment
                var newAssignment = new OrderTrackingAssignment
                {
                    OrderId = orderId,
                    DriverUserId = item.DriverUserId,
                    PlateNumber = item.PlateNumber,
                    TrackingReference = item.TrackingReference,
                    Notes = item.Notes,
                    TrackingStatus = "on_transit",
                    CreatedBy = userId,
                    EvidenceJson = evidenceJson,
                };
                db.OrderTrackingAssignments.Add(newAssignment);
                await db.SaveChangesAsync(); // persist assignment first to get its Id

                foreach (var m in item.Materials)
                {
                    db.OrderTrackingMaterials.Add(new OrderTrackingMaterial
                    {
                        AssignmentId = newAssignment.Id,
                        OrderItemId = m.OrderItemId,
                        AssignedQuantity = m.AssignedQuantity,
                    });
                }
            }
        }

        // Remove assignments not in the request
        var requestDriverIds = request.Assignments.Select(a => a.DriverUserId).ToHashSet();
        var toRemove = existing.Where(a => !requestDriverIds.Contains(a.DriverUserId)).ToList();
        db.OrderTrackingAssignments.RemoveRange(toRemove);

        await db.SaveChangesAsync();
        return await GetAssignmentsAsync(orderId);
    }

    public async Task<TrackingAssignmentDto?> MarkArrivedAsync(Guid assignmentId, Guid userId)
    {
        var assignment = await db.OrderTrackingAssignments.FindAsync(assignmentId);
        if (assignment == null) return null;

        assignment.TrackingStatus = "arrived";
        assignment.ArrivedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();
        return await GetSingleAsync(assignmentId);
    }

    public async Task<TrackingAssignmentDto?> HoldDriverAsync(Guid assignmentId, string? remarks, Guid userId)
    {
        var assignment = await db.OrderTrackingAssignments.FindAsync(assignmentId);
        if (assignment == null) return null;

        assignment.TrackingStatus = "on_hold";
        assignment.HoldRemarks = remarks;
        assignment.HeldAt = DateTime.UtcNow;
        await db.SaveChangesAsync();
        return await GetSingleAsync(assignmentId);
    }

    public async Task<TrackingAssignmentDto?> ResumeDriverAsync(Guid assignmentId, string? remarks, Guid userId)
    {
        var assignment = await db.OrderTrackingAssignments.FindAsync(assignmentId);
        if (assignment == null) return null;

        assignment.TrackingStatus = "on_transit";
        assignment.ResumeRemarks = remarks;
        assignment.ResumedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();
        return await GetSingleAsync(assignmentId);
    }

    public async Task<TrackingAssignmentDto?> SaveRemarksAsync(Guid assignmentId, string? remarks)
    {
        var assignment = await db.OrderTrackingAssignments.FindAsync(assignmentId);
        if (assignment == null) return null;

        assignment.Notes = remarks;
        await db.SaveChangesAsync();
        return await GetSingleAsync(assignmentId);
    }

    public async Task<TrackingAssignmentDto?> SaveReceiverEvidenceAsync(
        Guid assignmentId, List<TrackingEvidenceItem> evidence)
    {
        var assignment = await db.OrderTrackingAssignments.FindAsync(assignmentId);
        if (assignment == null) return null;

        assignment.ReceiverEvidenceJson = evidence.Count > 0
            ? JsonSerializer.Serialize(evidence)
            : null;
        await db.SaveChangesAsync();
        return await GetSingleAsync(assignmentId);
    }

    private async Task<TrackingAssignmentDto?> GetSingleAsync(Guid id)
    {
        var a = await db.OrderTrackingAssignments
            .Include(x => x.Driver)
            .Include(x => x.Creator)
            .Include(x => x.Materials).ThenInclude(m => m.OrderItem).ThenInclude(oi => oi.Sku)
            .FirstOrDefaultAsync(x => x.Id == id);
        return a == null ? null : Map(a);
    }

    private static TrackingAssignmentDto Map(OrderTrackingAssignment a) => new()
    {
        Id = a.Id,
        OrderId = a.OrderId,
        DriverUserId = a.DriverUserId,
        DriverName = a.Driver.FullName,
        DriverEmail = a.Driver.Email,
        PlateNumber = a.PlateNumber,
        TrackingReference = a.TrackingReference,
        Notes = a.Notes,
        TrackingStatus = a.TrackingStatus,
        ArrivedAt = a.ArrivedAt,
        HoldRemarks = a.HoldRemarks,
        HeldAt = a.HeldAt,
        ResumeRemarks = a.ResumeRemarks,
        ResumedAt = a.ResumedAt,
        CreatedBy = a.CreatedBy,
        CreatedByName = a.Creator?.FullName,
        CreatedAt = a.CreatedAt,
        Materials = a.Materials.Select(m => new TrackingMaterialDto
        {
            Id = m.Id,
            OrderItemId = m.OrderItemId,
            SkuName = m.OrderItem.Sku?.Name,
            Unit = m.OrderItem.Sku?.UnitOfMeasure,
            AssignedQuantity = m.AssignedQuantity,
            QuantityOrdered = m.OrderItem.QuantityOrdered,
        }).ToList(),
        Evidence = string.IsNullOrEmpty(a.EvidenceJson)
            ? []
            : JsonSerializer.Deserialize<List<TrackingEvidenceItem>>(a.EvidenceJson) ?? [],
        ReceiverEvidence = string.IsNullOrEmpty(a.ReceiverEvidenceJson)
            ? []
            : JsonSerializer.Deserialize<List<TrackingEvidenceItem>>(a.ReceiverEvidenceJson) ?? [],
    };
}
