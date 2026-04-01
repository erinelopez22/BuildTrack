using BuildTrack.API.Data;
using BuildTrack.API.DTOs.SKUs;
using BuildTrack.API.Models.Entities;
using BuildTrack.API.Services.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace BuildTrack.API.Services.Implementations;

public class SkuService(AppDbContext db) : ISkuService
{
    public async Task<List<SkuDto>> GetAllAsync(
        string? search, bool? isActive, string? category, string? sortBy, string? sortOrder,
        Guid? companyId = null, bool isSuperAdmin = false)
    {
        var query = db.SKUs.AsQueryable();

        if (!isSuperAdmin && companyId.HasValue)
            query = query.Where(s => s.CompanyId == companyId.Value);

        if (!string.IsNullOrWhiteSpace(search))
            query = query.Where(s =>
                s.Name.Contains(search) ||
                s.SkuCode.Contains(search) ||
                (s.Category != null && s.Category.Contains(search)));

        if (isActive.HasValue)
            query = query.Where(s => s.IsActive == isActive.Value);

        if (!string.IsNullOrWhiteSpace(category))
            query = query.Where(s => s.Category == category);

        query = (sortBy?.ToLower(), sortOrder?.ToLower()) switch
        {
            ("sku_code", "desc") => query.OrderByDescending(s => s.SkuCode),
            ("sku_code", _) => query.OrderBy(s => s.SkuCode),
            ("created_at", "desc") => query.OrderByDescending(s => s.CreatedAt),
            ("created_at", _) => query.OrderBy(s => s.CreatedAt),
            (_, "desc") => query.OrderByDescending(s => s.Name),
            _ => query.OrderBy(s => s.Name)
        };

        var skus = await query.ToListAsync();
        return skus.Select(Map).ToList();
    }

    public async Task<SkuDto?> GetByIdAsync(Guid id)
    {
        var sku = await db.SKUs.FindAsync(id);
        return sku == null ? null : Map(sku);
    }

    public async Task<(SkuDto? sku, string? error)> CreateAsync(CreateSkuRequest request, Guid createdBy, Guid? companyId = null)
    {
        if (await db.SKUs.AnyAsync(s => s.SkuCode.ToLower() == request.SkuCode.ToLower()))
            return (null, "SKU code already exists.");

        var sku = new SKU
        {
            SkuCode = request.SkuCode,
            Name = request.Name?.ToUpperInvariant() ?? "",
            Description = request.Description?.ToUpperInvariant(),
            Category = request.Category,
            UnitOfMeasure = request.UnitOfMeasure?.ToLowerInvariant(),
            Brand = request.Brand,
            Specifications = request.Specifications,
            DefaultMinThreshold = request.DefaultMinThreshold,
            IsActive = request.IsActive,
            CreatedBy = createdBy,
            CompanyId = companyId
        };
        db.SKUs.Add(sku);
        await db.SaveChangesAsync();
        return (Map(sku), null);
    }

    public async Task<SkuDto?> UpdateAsync(Guid id, UpdateSkuRequest request)
    {
        var sku = await db.SKUs.FindAsync(id);
        if (sku == null) return null;

        if (request.Name != null) sku.Name = request.Name.ToUpperInvariant();
        if (request.Description != null) sku.Description = request.Description.ToUpperInvariant();
        if (request.Category != null) sku.Category = request.Category;
        if (request.UnitOfMeasure != null) sku.UnitOfMeasure = request.UnitOfMeasure.ToLowerInvariant();
        if (request.Brand != null) sku.Brand = request.Brand;
        if (request.Specifications != null) sku.Specifications = request.Specifications;
        if (request.DefaultMinThreshold.HasValue) sku.DefaultMinThreshold = request.DefaultMinThreshold.Value;
        if (request.IsActive.HasValue) sku.IsActive = request.IsActive.Value;
        sku.UpdatedAt = DateTime.UtcNow;

        await db.SaveChangesAsync();
        return Map(sku);
    }

    public async Task<bool> DeleteAsync(Guid id)
    {
        var sku = await db.SKUs.FindAsync(id);
        if (sku == null) return false;
        // Soft-delete
        sku.IsActive = false;
        sku.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();
        return true;
    }

    public async Task<int> SeedConstructionMaterialsAsync(Guid createdBy, Guid? companyId = null)
    {
        var materials = new (string Name, string Unit, string Description, string Category)[]
        {
            // Concrete & Masonry
            ("PORTLAND CEMENT", "bag", "TYPE 1 PORTLAND CEMENT 40KG", "Concrete & Masonry"),
            ("CONCRETE HOLLOW BLOCK 4\"", "pcs", "4-INCH CHB STANDARD", "Concrete & Masonry"),
            ("CONCRETE HOLLOW BLOCK 6\"", "pcs", "6-INCH CHB STANDARD", "Concrete & Masonry"),
            ("WASHED SAND", "cu.m", "FINE WASHED SAND FOR PLASTERING", "Concrete & Masonry"),
            ("GRAVEL 3/4\"", "cu.m", "3/4 INCH CRUSHED GRAVEL", "Concrete & Masonry"),
            ("GRAVEL 1/2\"", "cu.m", "1/2 INCH CRUSHED GRAVEL", "Concrete & Masonry"),
            ("READY MIX CONCRETE", "cu.m", "READY MIX CONCRETE 3000 PSI", "Concrete & Masonry"),
            ("SAHARA CEMENT", "bag", "SAHARA MASONRY CEMENT 40KG", "Concrete & Masonry"),
            ("BRICKS COMMON", "pcs", "COMMON RED CLAY BRICKS", "Concrete & Masonry"),
            ("CONCRETE NEUTRALIZER", "liter", "CONCRETE SURFACE NEUTRALIZER", "Concrete & Masonry"),

            // Steel & Metal
            ("DEFORMED BAR 10MM", "length", "10MM DEFORMED STEEL REBAR 6M", "Steel & Metal"),
            ("DEFORMED BAR 12MM", "length", "12MM DEFORMED STEEL REBAR 6M", "Steel & Metal"),
            ("DEFORMED BAR 16MM", "length", "16MM DEFORMED STEEL REBAR 6M", "Steel & Metal"),
            ("DEFORMED BAR 20MM", "length", "20MM DEFORMED STEEL REBAR 6M", "Steel & Metal"),
            ("DEFORMED BAR 25MM", "length", "25MM DEFORMED STEEL REBAR 6M", "Steel & Metal"),
            ("G.I. TIE WIRE #16", "kg", "GALVANIZED IRON TIE WIRE GAUGE 16", "Steel & Metal"),
            ("ANGLE BAR 2\" X 2\" X 1/4\"", "length", "MILD STEEL ANGLE BAR 6M", "Steel & Metal"),
            ("ANGLE BAR 1-1/2\" X 1-1/2\" X 3/16\"", "length", "MILD STEEL ANGLE BAR 6M", "Steel & Metal"),
            ("C-CHANNEL 3\" X 6\"", "length", "C-CHANNEL STRUCTURAL STEEL 6M", "Steel & Metal"),
            ("FLAT BAR 1/4\" X 2\"", "length", "MILD STEEL FLAT BAR 6M", "Steel & Metal"),
            ("G.I. PIPE 1\"", "length", "GALVANIZED IRON PIPE 1 INCH 6M", "Steel & Metal"),
            ("G.I. PIPE 2\"", "length", "GALVANIZED IRON PIPE 2 INCH 6M", "Steel & Metal"),
            ("STEEL DECK", "sheet", "CORRUGATED STEEL DECK 0.8MM", "Steel & Metal"),
            ("WELDING ROD 6011", "kg", "WELDING ELECTRODE E6011 3.2MM", "Steel & Metal"),

            // Wood & Lumber
            ("COCO LUMBER 2\" X 2\" X 10'", "pcs", "COCONUT LUMBER GOOD QUALITY", "Wood & Lumber"),
            ("COCO LUMBER 2\" X 3\" X 10'", "pcs", "COCONUT LUMBER GOOD QUALITY", "Wood & Lumber"),
            ("COCO LUMBER 2\" X 4\" X 10'", "pcs", "COCONUT LUMBER GOOD QUALITY", "Wood & Lumber"),
            ("MARINE PLYWOOD 1/4\"", "sheet", "MARINE PLYWOOD 4X8 FT 1/4 INCH", "Wood & Lumber"),
            ("MARINE PLYWOOD 1/2\"", "sheet", "MARINE PLYWOOD 4X8 FT 1/2 INCH", "Wood & Lumber"),
            ("MARINE PLYWOOD 3/4\"", "sheet", "MARINE PLYWOOD 4X8 FT 3/4 INCH", "Wood & Lumber"),
            ("ORDINARY PLYWOOD 1/4\"", "sheet", "ORDINARY PLYWOOD 4X8 FT", "Wood & Lumber"),
            ("PHENOLIC BOARD 3/4\"", "sheet", "PHENOLIC BOARD 4X8 FT 3/4 INCH", "Wood & Lumber"),
            ("GOOD LUMBER 2\" X 2\" X 10'", "pcs", "KILN-DRIED GOOD LUMBER", "Wood & Lumber"),

            // Roofing
            ("CORRUGATED G.I. SHEET GA.26", "sheet", "PLAIN CORRUGATED ROOFING SHEET GAUGE 26", "Roofing"),
            ("PRE-PAINTED LONG SPAN GA.26", "sheet", "PRE-PAINTED LONG SPAN ROOFING", "Roofing"),
            ("RIDGE ROLL", "length", "G.I. RIDGE ROLL PLAIN", "Roofing"),
            ("GUTTER", "length", "G.I. GUTTER PLAIN 6M", "Roofing"),
            ("FLASHING", "length", "G.I. FLASHING PLAIN", "Roofing"),
            ("ROOF SEALANT", "tube", "SILICONE ROOF SEALANT 300ML", "Roofing"),
            ("TEK SCREW 2\"", "pcs", "SELF-DRILLING TEK SCREW WITH WASHER", "Roofing"),
            ("POLYCARBONATE ROOFING", "sheet", "CLEAR POLYCARBONATE CORRUGATED SHEET", "Roofing"),

            // Plumbing
            ("PVC PIPE 1/2\" S-1000", "length", "PVC PRESSURE PIPE 1/2 INCH 3M", "Plumbing"),
            ("PVC PIPE 3/4\" S-1000", "length", "PVC PRESSURE PIPE 3/4 INCH 3M", "Plumbing"),
            ("PVC PIPE 4\" S-1000", "length", "PVC SANITARY PIPE 4 INCH 3M", "Plumbing"),
            ("PVC PIPE 3\" S-1000", "length", "PVC SANITARY PIPE 3 INCH 3M", "Plumbing"),
            ("PVC PIPE 2\" S-1000", "length", "PVC SANITARY PIPE 2 INCH 3M", "Plumbing"),
            ("PVC ELBOW 1/2\"", "pcs", "PVC 90-DEGREE ELBOW 1/2 INCH", "Plumbing"),
            ("PVC ELBOW 4\"", "pcs", "PVC 90-DEGREE ELBOW 4 INCH", "Plumbing"),
            ("PVC TEE 1/2\"", "pcs", "PVC TEE FITTING 1/2 INCH", "Plumbing"),
            ("PVC TEE 4\"", "pcs", "PVC TEE FITTING 4 INCH", "Plumbing"),
            ("PVC SOLVENT CEMENT", "can", "PVC SOLVENT CEMENT 200ML", "Plumbing"),
            ("GATE VALVE 1/2\"", "pcs", "BRASS GATE VALVE 1/2 INCH", "Plumbing"),
            ("WATER CLOSET", "set", "DUAL FLUSH WATER CLOSET COMPLETE SET", "Plumbing"),
            ("LAVATORY FAUCET", "pcs", "CHROME LAVATORY FAUCET", "Plumbing"),
            ("FLOOR DRAIN 4\"", "pcs", "STAINLESS STEEL FLOOR DRAIN 4 INCH", "Plumbing"),

            // Electrical
            ("THHN WIRE #12 AWG", "roll", "THHN STRANDED COPPER WIRE 12AWG 150M", "Electrical"),
            ("THHN WIRE #14 AWG", "roll", "THHN STRANDED COPPER WIRE 14AWG 150M", "Electrical"),
            ("THHN WIRE #10 AWG", "roll", "THHN STRANDED COPPER WIRE 10AWG 75M", "Electrical"),
            ("PVC CONDUIT PIPE 1/2\"", "length", "ORANGE PVC ELECTRICAL CONDUIT 1/2 INCH 3M", "Electrical"),
            ("PVC CONDUIT PIPE 3/4\"", "length", "ORANGE PVC ELECTRICAL CONDUIT 3/4 INCH 3M", "Electrical"),
            ("JUNCTION BOX", "pcs", "PVC UTILITY/JUNCTION BOX", "Electrical"),
            ("OUTLET DUPLEX", "pcs", "UNIVERSAL DUPLEX CONVENIENCE OUTLET", "Electrical"),
            ("SWITCH SINGLE GANG", "pcs", "SINGLE GANG SWITCH WITH PLATE", "Electrical"),
            ("SWITCH DOUBLE GANG", "pcs", "DOUBLE GANG SWITCH WITH PLATE", "Electrical"),
            ("CIRCUIT BREAKER 20A", "pcs", "PLUG-IN CIRCUIT BREAKER 20 AMP", "Electrical"),
            ("PANEL BOARD 4-BRANCH", "pcs", "PLUG-IN LOAD CENTER 4 BRANCHES", "Electrical"),
            ("ELECTRICAL TAPE", "roll", "VINYL ELECTRICAL INSULATION TAPE", "Electrical"),
            ("LED BULB 12W", "pcs", "LED BULB 12 WATTS DAYLIGHT", "Electrical"),

            // Doors & Windows
            ("PANEL DOOR", "pcs", "FLUSH PANEL DOOR 0.80M X 2.10M", "Doors & Windows"),
            ("PLYWOOD DOOR", "pcs", "PLYWOOD FLUSH DOOR 0.70M X 2.10M", "Doors & Windows"),
            ("JALOUSIE WINDOW 24\" X 24\"", "set", "ALUMINUM JALOUSIE WINDOW WITH FRAME", "Doors & Windows"),
            ("SLIDING WINDOW 48\" X 48\"", "set", "ALUMINUM SLIDING WINDOW WITH FRAME", "Doors & Windows"),
            ("DOOR KNOB ENTRANCE", "set", "STAINLESS STEEL ENTRANCE DOOR KNOB SET", "Doors & Windows"),
            ("DOOR HINGES 4\"", "pair", "STAINLESS STEEL BUTT HINGES 4 INCH", "Doors & Windows"),
            ("SCREEN WIRE", "roll", "NYLON SCREEN WIRE 4FT", "Doors & Windows"),

            // Finishing
            ("LATEX PAINT WHITE", "gallon", "ACRYLIC LATEX PAINT GLOSS WHITE", "Finishing"),
            ("LATEX PAINT SEMI-GLOSS", "gallon", "ACRYLIC LATEX PAINT SEMI-GLOSS", "Finishing"),
            ("FLAT WALL ENAMEL", "gallon", "ALKYD FLAT WALL ENAMEL", "Finishing"),
            ("PRIMER PAINT", "gallon", "ACRYLIC WALL PRIMER SEALER", "Finishing"),
            ("PAINT ROLLER 7\"", "pcs", "PAINT ROLLER WITH HANDLE 7 INCH", "Finishing"),
            ("PAINT BRUSH 4\"", "pcs", "PAINT BRUSH 4 INCH", "Finishing"),
            ("FLOOR TILE 60X60CM", "pcs", "CERAMIC FLOOR TILE 60X60 CM", "Finishing"),
            ("WALL TILE 30X60CM", "pcs", "CERAMIC WALL TILE 30X60 CM", "Finishing"),
            ("TILE ADHESIVE", "bag", "PREMIUM TILE ADHESIVE 25KG", "Finishing"),
            ("TILE GROUT", "kg", "COLORED TILE GROUT", "Finishing"),
            ("SKIMCOAT", "bag", "WALL SKIMCOAT FINISH 25KG", "Finishing"),
            ("WALL PUTTY", "kg", "ACRYLIC WALL PUTTY", "Finishing"),

            // Hardware & Fasteners
            ("COMMON NAIL 2\"", "kg", "COMMON WIRE NAIL 2 INCH", "Hardware & Fasteners"),
            ("COMMON NAIL 3\"", "kg", "COMMON WIRE NAIL 3 INCH", "Hardware & Fasteners"),
            ("COMMON NAIL 4\"", "kg", "COMMON WIRE NAIL 4 INCH", "Hardware & Fasteners"),
            ("CONCRETE NAIL 2\"", "kg", "HARDENED CONCRETE NAIL 2 INCH", "Hardware & Fasteners"),
            ("BOLT WITH NUT 1/2\" X 4\"", "pcs", "HEX BOLT WITH NUT 1/2 X 4 INCH", "Hardware & Fasteners"),
            ("WOOD SCREW 2\"", "box", "WOOD SCREW #10 X 2 INCH 100PCS", "Hardware & Fasteners"),
            ("EXPANSION BOLT 1/2\"", "pcs", "CONCRETE EXPANSION ANCHOR BOLT 1/2 INCH", "Hardware & Fasteners"),
            ("HACKSAW BLADE", "pcs", "BI-METAL HACKSAW BLADE 12 INCH", "Hardware & Fasteners"),
            ("MASKING TAPE 1\"", "roll", "GENERAL PURPOSE MASKING TAPE 1 INCH", "Hardware & Fasteners"),

            // Waterproofing & Insulation
            ("WATERPROOFING MEMBRANE", "roll", "SELF-ADHESIVE WATERPROOFING MEMBRANE", "Waterproofing & Insulation"),
            ("ELASTOMERIC WATERPROOFING", "gallon", "ELASTOMERIC WATERPROOFING COATING", "Waterproofing & Insulation"),
            ("CAULKING SEALANT", "tube", "SILICONE CAULKING SEALANT 300ML", "Waterproofing & Insulation"),
            ("THERMAL INSULATION BOARD", "sheet", "EPS THERMAL INSULATION BOARD 1 INCH", "Waterproofing & Insulation"),
            ("POLYETHYLENE FILM", "roll", "POLYETHYLENE MOISTURE BARRIER FILM", "Waterproofing & Insulation"),
        };

        var counter = 1;
        var added = 0;
        foreach (var (name, unit, description, category) in materials)
        {
            // Skip if name+unit combo already exists
            if (await db.SKUs.AnyAsync(s => s.Name == name && s.UnitOfMeasure == unit))
                continue;

            db.SKUs.Add(new SKU
            {
                SkuCode = $"MAT-{counter:D4}",
                Name = name,
                Description = description,
                Category = category,
                UnitOfMeasure = unit,
                IsActive = true,
                CreatedBy = createdBy,
                CompanyId = companyId
            });
            added++;
            counter++;
        }

        if (added > 0)
            await db.SaveChangesAsync();

        return added;
    }

    private static SkuDto Map(SKU s) => new()
    {
        Id = s.Id,
        SkuCode = s.SkuCode,
        Name = s.Name,
        Description = s.Description,
        Category = s.Category,
        UnitOfMeasure = s.UnitOfMeasure,
        Brand = s.Brand,
        Specifications = s.Specifications,
        DefaultMinThreshold = s.DefaultMinThreshold,
        IsActive = s.IsActive,
        CreatedAt = s.CreatedAt,
        UpdatedAt = s.UpdatedAt
    };
}
