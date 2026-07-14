// venues.js
// The list of "venues" this tracker covers. Adapted from the Ballpark Tracker's
// generic pattern for Broadway theatres. Same structure: id, name, group, division/
// operator, location — everything else in app.js reads from VENUES generically.
//
// Data current as of mid-2026. There are 41 active Broadway theatres, all in
// Manhattan (all but the Vivian Beaumont are in the Theater District near Times
// Square). A few have been renamed in recent years (Cort → James Earl Jones,
// Brooks Atkinson → Lena Horne, American Airlines → Todd Haimes) — reflected below.
// Theatre buildings and addresses rarely change, but if you spot one that's off or
// renamed since, it's a one-line edit here.

export const APP_TITLE = "Broadway Tracker";
export const ENTITY_LABEL = "theatre"; // used in stats text: "of 41 theatres visited"
export const ENTITY_LABEL_PLURAL = "theatres";

// Separate Firestore collection + storage prefix so this app's data doesn't mix
// with the Ballpark Tracker's, even though both live in the same Firebase project.
export const COLLECTION_NAME = "theatreVisits";
export const STORAGE_PREFIX = "theatre";

export const VENUES = [
  // Shubert Organization
  { id: "ambassador", name: "Ambassador Theatre", group: "Shubert Organization", division: "Shubert Organization", location: "219 W 49th St, Manhattan" },
  { id: "barrymore", name: "Ethel Barrymore Theatre", group: "Shubert Organization", division: "Shubert Organization", location: "243 W 47th St, Manhattan" },
  { id: "belasco", name: "Belasco Theatre", group: "Shubert Organization", division: "Shubert Organization", location: "111 W 44th St, Manhattan" },
  { id: "jacobs", name: "Bernard B. Jacobs Theatre", group: "Shubert Organization", division: "Shubert Organization", location: "242 W 45th St, Manhattan" },
  { id: "booth", name: "Booth Theatre", group: "Shubert Organization", division: "Shubert Organization", location: "222 W 45th St, Manhattan" },
  { id: "broadhurst", name: "Broadhurst Theatre", group: "Shubert Organization", division: "Shubert Organization", location: "235 W 44th St, Manhattan" },
  { id: "broadwaytheatre", name: "Broadway Theatre", group: "Shubert Organization", division: "Shubert Organization", location: "1681 Broadway, Manhattan" },
  { id: "golden", name: "John Golden Theatre", group: "Shubert Organization", division: "Shubert Organization", location: "252 W 45th St, Manhattan" },
  { id: "imperial", name: "Imperial Theatre", group: "Shubert Organization", division: "Shubert Organization", location: "249 W 45th St, Manhattan" },
  { id: "longacre", name: "Longacre Theatre", group: "Shubert Organization", division: "Shubert Organization", location: "220 W 48th St, Manhattan" },
  { id: "lyceum", name: "Lyceum Theatre", group: "Shubert Organization", division: "Shubert Organization", location: "149 W 45th St, Manhattan" },
  { id: "majestic", name: "Majestic Theatre", group: "Shubert Organization", division: "Shubert Organization", location: "245 W 44th St, Manhattan" },
  { id: "musicbox", name: "Music Box Theatre", group: "Shubert Organization", division: "Shubert Organization", location: "239 W 45th St, Manhattan" },
  { id: "shuberttheatre", name: "Shubert Theatre", group: "Shubert Organization", division: "Shubert Organization", location: "225 W 44th St, Manhattan" },
  { id: "wintergarden", name: "Winter Garden Theatre", group: "Shubert Organization", division: "Shubert Organization", location: "1634 Broadway, Manhattan" },
  { id: "jamesearljones", name: "James Earl Jones Theatre", group: "Shubert Organization", division: "Shubert Organization", location: "138 W 48th St, Manhattan" },
  { id: "schoenfeld", name: "Gerald Schoenfeld Theatre", group: "Shubert Organization", division: "Shubert Organization", location: "236 W 45th St, Manhattan" },

  // Nederlander Organization
  { id: "gershwin", name: "Gershwin Theatre", group: "Nederlander Organization", division: "Nederlander Organization", location: "222 W 51st St, Manhattan" },
  { id: "lenahorne", name: "Lena Horne Theatre", group: "Nederlander Organization", division: "Nederlander Organization", location: "256 W 47th St, Manhattan" },
  { id: "luntfontanne", name: "Lunt-Fontanne Theatre", group: "Nederlander Organization", division: "Nederlander Organization", location: "205 W 46th St, Manhattan" },
  { id: "marquis", name: "Marquis Theatre", group: "Nederlander Organization", division: "Nederlander Organization", location: "1535 Broadway, Manhattan" },
  { id: "minskoff", name: "Minskoff Theatre", group: "Nederlander Organization", division: "Nederlander Organization", location: "200 W 45th St, Manhattan" },
  { id: "nederlander", name: "Nederlander Theatre", group: "Nederlander Organization", division: "Nederlander Organization", location: "208 W 41st St, Manhattan" },
  { id: "neilsimon", name: "Neil Simon Theatre", group: "Nederlander Organization", division: "Nederlander Organization", location: "250 W 52nd St, Manhattan" },
  { id: "palace", name: "Palace Theatre", group: "Nederlander Organization", division: "Nederlander Organization", location: "1564 Broadway, Manhattan" },
  { id: "richardrodgers", name: "Richard Rodgers Theatre", group: "Nederlander Organization", division: "Nederlander Organization", location: "226 W 46th St, Manhattan" },

  // Jujamcyn Theaters
  { id: "hirschfeld", name: "Al Hirschfeld Theatre", group: "Jujamcyn Theaters", division: "Jujamcyn Theaters", location: "302 W 45th St, Manhattan" },
  { id: "augustwilson", name: "August Wilson Theatre", group: "Jujamcyn Theaters", division: "Jujamcyn Theaters", location: "245 W 52nd St, Manhattan" },
  { id: "oneill", name: "Eugene O'Neill Theatre", group: "Jujamcyn Theaters", division: "Jujamcyn Theaters", location: "230 W 49th St, Manhattan" },
  { id: "stjames", name: "St. James Theatre", group: "Jujamcyn Theaters", division: "Jujamcyn Theaters", location: "246 W 44th St, Manhattan" },
  { id: "walterkerr", name: "Walter Kerr Theatre", group: "Jujamcyn Theaters", division: "Jujamcyn Theaters", location: "219 W 48th St, Manhattan" },

  // Independent / other operators
  { id: "circleinthesquare", name: "Circle in the Square Theatre", group: "Independent / Other", division: "Independent / Other", location: "235 W 50th St, Manhattan" },
  { id: "hayes", name: "Hayes Theater", group: "Independent / Other (Second Stage)", division: "Independent / Other", location: "240 W 44th St, Manhattan" },
  { id: "hudson", name: "Hudson Theatre", group: "Independent / Other (ATG)", division: "Independent / Other", location: "141 W 44th St, Manhattan" },
  { id: "lyric", name: "Lyric Theatre", group: "Independent / Other (ATG)", division: "Independent / Other", location: "213 W 42nd St, Manhattan" },
  { id: "newamsterdam", name: "New Amsterdam Theatre", group: "Independent / Other (Disney Theatrical)", division: "Independent / Other", location: "214 W 42nd St, Manhattan" },
  { id: "studio54", name: "Studio 54", group: "Independent / Other (Roundabout)", division: "Independent / Other", location: "254 W 54th St, Manhattan" },
  { id: "toddhaimes", name: "Todd Haimes Theatre", group: "Independent / Other (Roundabout)", division: "Independent / Other", location: "227 W 42nd St, Manhattan" },
  { id: "sondheim", name: "Stephen Sondheim Theatre", group: "Independent / Other (ATG)", division: "Independent / Other", location: "124 W 43rd St, Manhattan" },
  { id: "friedman", name: "Samuel J. Friedman Theatre", group: "Independent / Other (Manhattan Theatre Club)", division: "Independent / Other", location: "261 W 47th St, Manhattan" },
  { id: "vivianbeaumont", name: "Vivian Beaumont Theater", group: "Independent / Other (Lincoln Center Theater)", division: "Independent / Other", location: "150 W 65th St, Manhattan" },
];

export const DIVISION_ORDER = [
  "Shubert Organization", "Nederlander Organization", "Jujamcyn Theaters", "Independent / Other"
];
