using System.Security.Cryptography;
using System.Text.Json;
using Frosty.Sdk.IO;
using Frosty.Sdk.IO.Compression;
using Frosty.Sdk.Utils;

if (args.Length != 2)
{
    Console.Error.WriteLine("Usage: FrostyPayloadAudit <plan.json> <report.json>");
    return 2;
}

Payload[] payloads = JsonSerializer.Deserialize<Payload[]>(File.ReadAllText(args[0])) ?? [];
List<Result> results = [];
foreach (Payload payload in payloads)
{
    try
    {
        using FileStream file = File.OpenRead(payload.Cas);
        if (payload.Offset < 0 || payload.Size <= 0 || payload.Offset > file.Length - payload.Size)
            throw new InvalidDataException($"Payload range is outside CAS bounds: {payload.Offset}+{payload.Size}/{file.Length}");
        file.Position = payload.Offset;
        using Block<byte> compressed = new(payload.Size);
        file.ReadExactly(compressed.ToSpan());
        using BlockStream boundedStream = new(compressed);
        using Block<byte> data = Cas.DecompressData(boundedStream, payload.OriginalSize);
        string actual = Convert.ToHexString(SHA256.HashData(data.ToSpan())).ToLowerInvariant();
        results.Add(new Result(payload.Name, actual == payload.ExpectedSha256, actual, null));
    }
    catch (Exception ex)
    {
        results.Add(new Result(payload.Name, false, string.Empty, ex.Message));
    }
}

var report = new { Total = results.Count, Matches = results.Count(x => x.Matches), Errors = results.Count(x => x.Error is not null), Results = results };
File.WriteAllText(args[1], JsonSerializer.Serialize(report, new JsonSerializerOptions { WriteIndented = true }));
Console.WriteLine(JsonSerializer.Serialize(new { report.Total, report.Matches, report.Errors }));
return report.Matches == report.Total ? 0 : 1;

record Payload(string Name, string Cas, long Offset, int Size, int OriginalSize, string ExpectedSha256);
record Result(string Name, bool Matches, string ActualSha256, string? Error);
