// The user-observed visual start is 1 s after the race audio event.
// Keep the editor marker at the musical drop; compensate only in the renderer.
const RACE_START_LEAD_SECONDS=1;
function raceStart(marker){
  if(!Number.isFinite(marker)||marker<RACE_START_LEAD_SECONDS)
    throw new Error('Invalid musical drop marker: '+marker);
  return marker-RACE_START_LEAD_SECONDS;
}
module.exports={raceStart,RACE_START_LEAD_SECONDS};
