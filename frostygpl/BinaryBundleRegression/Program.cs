using System.Buffers.Binary;
using Frosty.Sdk;
using Frosty.Sdk.IO;
using Frosty.Sdk.Utils;
using Frosty.Sdk.DbObjectElements;
using Frosty.ModSupport.ModEntries;
using Frosty.ModSupport.ModInfos;
using Writer=Frosty.ModSupport.BinaryBundle;

// Calls the actual production writer, then reads raw hash-table bytes independently.
static Sha1 Hash(int n)=>new(Enumerable.Repeat((byte)n,20).ToArray());
static void Check(bool value,string message){if(!value)throw new Exception(message);}
var chunkIds=new[]{Guid.Parse("11111111-1111-1111-1111-111111111111"),Guid.Parse("22222222-2222-2222-2222-222222222222")};
byte[] Fixture(){
 using var data=new Block<byte>(0);using var s=new BlockStream(data,true);
 void U(uint n)=>s.WriteUInt32(n,Endian.Big);
 U(0);U((uint)Frosty.Sdk.IO.BinaryBundle.Magic.Standard^Frosty.Sdk.IO.BinaryBundle.GetSalt());U(6);U(2);U(2);U(2);U(0);U(0);U(0);
 for(int i=0;i<6;i++)s.WriteSha1(Hash(i+1));
 foreach(uint off in new uint[]{0,5,10,15}){U(off);U(100);}
 U(7);U(8);s.Write(new byte[32]);s.WriteUInt64(10,Endian.Big);s.WriteUInt64(20,Endian.Big);
 foreach(var id in chunkIds){s.WriteGuid(id,Endian.Big);U(0);U(100);}
 uint meta=(uint)s.Position-4;DbObject.Serialize(s,DbObject.CreateList(0));uint metaSize=(uint)s.Position-4-meta;
 uint strings=(uint)s.Position-4;foreach(string name in new[]{"ebx0","ebx1","res0","res1"})s.WriteNullTerminatedString(name);
 uint length=(uint)s.Length;s.Position=0;U(length-4);s.Position=24;U(strings);U(meta);U(metaSize);
 return data.ToSpan().ToArray();
}
try {
var fixture=Fixture();int passed=0;
foreach(string scenario in new[]{"unchanged","ebx","res","chunk","mixed","mixed-with-additions"}){
 var info=new BundleModInfo();var ebx=new Dictionary<string,EbxModEntry>();var res=new Dictionary<string,ResModEntry>();var chunks=new Dictionary<Guid,ChunkModEntry>();
 var expected=Enumerable.Range(1,6).Select(Hash).ToList();
 bool mixed=scenario.StartsWith("mixed");
 if(mixed||scenario=="ebx"){ebx["ebx1"]=new("ebx1",Hash(11),101);info.Modified.Ebx.Add("ebx1");expected[1]=Hash(11);}
 if(mixed||scenario=="res"){res["res1"]=new("res1",Hash(12),102,20,8,new byte[16]);info.Modified.Res.Add("res1");expected[3]=Hash(12);}
 if(mixed||scenario=="chunk"){chunks[chunkIds[1]]=new(chunkIds[1],Hash(13),0,103);info.Modified.Chunks.Add(chunkIds[1]);expected[5]=Hash(13);}
 if(scenario=="mixed-with-additions"){
  ebx["ebx2"]=new("ebx2",Hash(21),104);info.Added.Ebx.Add("ebx2");expected.Insert(2,Hash(21));
  res["res2"]=new("res2",Hash(22),105,30,9,new byte[16]);info.Added.Res.Add("res2");expected.Insert(5,Hash(22));
  var id=Guid.Parse("33333333-3333-3333-3333-333333333333");chunks[id]=new(id,Hash(23),0,106);info.Added.Chunks.Add(id);expected.Add(Hash(23));
 }
 using var input=new Block<byte>(fixture.Length);fixture.CopyTo(input.ToSpan());using var reader=new BlockStream(input);
 var callbacks=new List<(string,int,bool)>();
 using var output=Writer.Modify(reader,info,ebx,res,chunks,(entry,i,added,modified,size)=>{if(modified)callbacks.Add((entry.Sha1.ToString(),i,added));});
 var raw=output.ToSpan();Check(BinaryPrimitives.ReadUInt32BigEndian(raw[8..])==expected.Count,scenario+" count");
 for(int i=0;i<expected.Count;i++)Check(new Sha1(raw.Slice(36+i*20,20)).ToString()==expected[i].ToString(),scenario+" SHA table slot "+i);
 foreach(var (sha,index,_) in callbacks)Check(expected[index].ToString()==sha,scenario+" callback index "+index);
 Check(fixture.AsSpan().SequenceEqual(input.ToSpan()),scenario+" input mutation");
 Console.WriteLine("PASS "+scenario);passed++;
}
Console.WriteLine($"PASS {passed}/6 production BinaryBundle regressions");
return 0;
} catch(Exception e){Console.Error.WriteLine("FAIL "+e.Message);return 1;}
