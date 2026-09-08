export const BRAND_LOGO =
  "https://customer-assets-m6fa6gv7.emergentagent.net/job_5f84f188-f9b9-48e1-9d5b-4818959afc36/artifacts/2xymfev9_MMEP%2011.jpg";

export const formatINR = (n) => {
  if (n === null || n === undefined) return "—";
  return "₹" + Number(n).toLocaleString("en-IN");
};

export const HYD_AREAS = [
  "Banjara Hills", "Jubilee Hills", "Gachibowli", "Madhapur", "Hitec City", "Kondapur",
  "Kukatpally", "Secunderabad", "Begumpet", "Malkajgiri", "Miyapur", "Financial District",
];
