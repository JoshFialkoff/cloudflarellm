const facilitiesData = {
  1: {
    id: 1,
    slug: "sunrise-boston",
    name: "Sunrise Senior Living of Boston",
    address: "123 Commonwealth Ave, Boston, MA 02115",
    phone: "(617) 555-0101",
    email: "info@sunriseboston.example.com",
    rating: 4.7,
    complianceRating: "Excellent",
    crimeRating: { facility: "Low", community: "Very Low" },
    culturalAffinity: ["Jewish-friendly"],
    careTypes: ["Assisted Living", "Memory Care"],
    capacity: 120,
    monthlyMin: 4500,
    monthlyMax: 7500,
    about:
      "Sunrise Senior Living of Boston has been providing exceptional care for seniors since 1998. Located in the heart of Boston, our community offers a warm, supportive environment with professional 24/7 care staff. We specialize in assisted living and memory care with a person-centered approach.",
    complianceHistory: [
      { date: "Jan 2024", type: "Annual Inspection", findings: "No deficiencies found", status: "Pass" },
      { date: "Jun 2023", type: "Complaint Investigation", findings: "Unsubstantiated", status: "Resolved" },
      { date: "Jan 2023", type: "Annual Inspection", findings: "Minor documentation issue", status: "Corrected" },
      { date: "Jan 2022", type: "Annual Inspection", findings: "No deficiencies found", status: "Pass" },
      { date: "Jan 2021", type: "Annual Inspection", findings: "No deficiencies found", status: "Pass" },
    ],
    amenities: [
      { icon: "🍽️", name: "Restaurant-Style Dining" },
      { icon: "🏋️", name: "Fitness Center" },
      { icon: "🚌", name: "Transportation Services" },
      { icon: "💊", name: "Medication Management" },
      { icon: "🧘", name: "Yoga & Wellness" },
      { icon: "📚", name: "Library & Reading Room" },
      { icon: "🎨", name: "Arts & Crafts Studio" },
      { icon: "🌳", name: "Garden & Walking Paths" },
      { icon: "💈", name: "Beauty Salon & Barber" },
      { icon: "🎵", name: "Music & Entertainment" },
      { icon: "🐾", name: "Pet-Friendly Community" },
      { icon: "🙏", name: "Chaplaincy Services" },
    ],
  },
  2: {
    id: 2,
    slug: "cambridge-care-rehabilitation",
    name: "Cambridge Care & Rehabilitation",
    address: "456 Massachusetts Ave, Cambridge, MA 02139",
    phone: "(617) 555-0202",
    email: "admissions@cambridgecare.example.com",
    rating: 4.3,
    complianceRating: "Good",
    crimeRating: { facility: "Low", community: "Low" },
    culturalAffinity: ["Greek-speaking staff"],
    careTypes: ["Skilled Nursing", "Assisted Living"],
    capacity: 85,
    monthlyMin: 5200,
    monthlyMax: 8500,
    about:
      "Cambridge Care & Rehabilitation offers specialized skilled nursing and assisted living services in the vibrant Cambridge community. Our interdisciplinary care team focuses on rehabilitation and long-term care excellence, with close proximity to world-class medical centers.",
    complianceHistory: [
      { date: "Mar 2024", type: "Annual Inspection", findings: "Two minor deficiencies", status: "Corrected" },
      { date: "Sep 2023", type: "Follow-up Inspection", findings: "Previous findings corrected", status: "Pass" },
      { date: "Mar 2023", type: "Annual Inspection", findings: "Three deficiencies noted", status: "Corrected" },
      { date: "Mar 2022", type: "Annual Inspection", findings: "One minor deficiency", status: "Corrected" },
      { date: "Mar 2021", type: "Annual Inspection", findings: "No deficiencies found", status: "Pass" },
    ],
    amenities: [
      { icon: "🍽️", name: "Chef-Prepared Meals" },
      { icon: "🏥", name: "On-Site Medical Care" },
      { icon: "🚌", name: "Medical Transportation" },
      { icon: "💊", name: "Pharmacy Services" },
      { icon: "🧪", name: "Lab Services On-Site" },
      { icon: "📚", name: "Patient Library" },
      { icon: "🌳", name: "Outdoor Courtyard" },
      { icon: "🎵", name: "Music Therapy" },
      { icon: "💈", name: "Beauty Services" },
      { icon: "📺", name: "Private TV in Rooms" },
      { icon: "🙏", name: "Interfaith Chapel" },
      { icon: "👨‍👩‍👧", name: "Family Lounge Areas" },
    ],
  },
  3: {
    id: 3,
    slug: "newton-highlands-senior-community",
    name: "Newton Highlands Senior Community",
    address: "789 Chestnut St, Newton, MA 02461",
    phone: "(617) 555-0303",
    email: "info@newtonhighlands.example.com",
    rating: 4.9,
    complianceRating: "Excellent",
    crimeRating: { facility: "Very Low", community: "Very Low" },
    culturalAffinity: ["Jewish-friendly"],
    careTypes: ["Independent Living", "Assisted Living"],
    capacity: 150,
    monthlyMin: 3800,
    monthlyMax: 6200,
    about:
      "Newton Highlands Senior Community is one of Massachusetts' most highly-rated senior living communities. Our expansive campus offers a full continuum of care from independent to assisted living, with resort-style amenities and a vibrant social calendar.",
    complianceHistory: [
      { date: "Feb 2024", type: "Annual Inspection", findings: "No deficiencies found", status: "Pass" },
      { date: "Feb 2023", type: "Annual Inspection", findings: "No deficiencies found", status: "Pass" },
      { date: "Feb 2022", type: "Annual Inspection", findings: "No deficiencies found", status: "Pass" },
      { date: "Feb 2021", type: "Annual Inspection", findings: "No deficiencies found", status: "Pass" },
      { date: "Feb 2020", type: "Annual Inspection", findings: "No deficiencies found", status: "Pass" },
    ],
    amenities: [
      { icon: "🍽️", name: "Multiple Dining Venues" },
      { icon: "🏋️", name: "Full Fitness Center" },
      { icon: "🏊", name: "Heated Indoor Pool" },
      { icon: "🎨", name: "Art Studio" },
      { icon: "🎭", name: "Theater & Performance Space" },
      { icon: "🌳", name: "Scenic Walking Trails" },
      { icon: "🚌", name: "Scheduled Transportation" },
      { icon: "📚", name: "Extensive Library" },
      { icon: "💈", name: "Full-Service Salon" },
      { icon: "🏌️", name: "Golf Putting Green" },
      { icon: "🐾", name: "Pet-Friendly" },
      { icon: "💻", name: "Technology Center" },
    ],
  },
  4: {
    id: 4,
    slug: "worcester-memory-care-center",
    name: "Worcester Memory Care Center",
    address: "321 Park Ave, Worcester, MA 01609",
    phone: "(508) 555-0404",
    email: "info@worcestermemorycare.example.com",
    rating: 4.2,
    complianceRating: "Good",
    crimeRating: { facility: "Low", community: "Moderate" },
    culturalAffinity: ["Spanish-speaking staff"],
    careTypes: ["Memory Care", "Skilled Nursing"],
    capacity: 65,
    monthlyMin: 4000,
    monthlyMax: 6800,
    about:
      "Worcester Memory Care Center specializes in providing compassionate, evidence-based care for individuals with Alzheimer's disease and other forms of dementia. Our specially trained staff and secure environment ensure the safety and dignity of every resident.",
    complianceHistory: [
      { date: "Apr 2024", type: "Annual Inspection", findings: "One deficiency noted", status: "Corrected" },
      { date: "Oct 2023", type: "Follow-up", findings: "Previous deficiency corrected", status: "Pass" },
      { date: "Apr 2023", type: "Annual Inspection", findings: "Two deficiencies noted", status: "Corrected" },
      { date: "Apr 2022", type: "Annual Inspection", findings: "No deficiencies found", status: "Pass" },
      { date: "Apr 2021", type: "Annual Inspection", findings: "One minor deficiency", status: "Corrected" },
    ],
    amenities: [
      { icon: "🔒", name: "Secure Memory Unit" },
      { icon: "🎵", name: "Music Therapy Program" },
      { icon: "🍽️", name: "Specialized Nutrition" },
      { icon: "🌳", name: "Secured Outdoor Garden" },
      { icon: "🐾", name: "Pet Therapy Visits" },
      { icon: "🎨", name: "Sensory Activities" },
      { icon: "💊", name: "Medication Management" },
      { icon: "👨‍⚕️", name: "Dementia Specialist Staff" },
      { icon: "🙏", name: "Spiritual Care" },
      { icon: "👨‍👩‍👧", name: "Family Support Group" },
      { icon: "📺", name: "Reminiscence Therapy" },
      { icon: "🏥", name: "Hospice Coordination" },
    ],
  },
  5: {
    id: 5,
    slug: "springfield-elder-care-village",
    name: "Springfield Elder Care Village",
    address: "654 Main St, Springfield, MA 01103",
    phone: "(413) 555-0505",
    email: "contact@springfieldeldercare.example.com",
    rating: 3.6,
    complianceRating: "Needs Improvement",
    crimeRating: { facility: "Moderate", community: "High" },
    culturalAffinity: ["Spanish-speaking staff"],
    careTypes: ["Independent Living", "Assisted Living", "Memory Care"],
    capacity: 200,
    monthlyMin: 2800,
    monthlyMax: 5500,
    about:
      "Springfield Elder Care Village is a large continuing care community serving western Massachusetts. While we are working to improve our compliance record, we offer a full range of care options at competitive pricing, with a strong commitment to improvement.",
    complianceHistory: [
      { date: "May 2024", type: "Annual Inspection", findings: "Five deficiencies noted", status: "In Progress" },
      { date: "Nov 2023", type: "Follow-up Inspection", findings: "Partial compliance", status: "In Progress" },
      { date: "May 2023", type: "Annual Inspection", findings: "Seven deficiencies noted", status: "Corrected" },
      { date: "May 2022", type: "Annual Inspection", findings: "Three deficiencies noted", status: "Corrected" },
      { date: "May 2021", type: "Annual Inspection", findings: "Two deficiencies noted", status: "Corrected" },
    ],
    amenities: [
      { icon: "🍽️", name: "Cafeteria-Style Dining" },
      { icon: "🏊", name: "Swimming Pool" },
      { icon: "🎮", name: "Game Room" },
      { icon: "💈", name: "Beauty Salon" },
      { icon: "🙏", name: "Multi-Faith Chapel" },
      { icon: "🚌", name: "Transportation" },
      { icon: "🌳", name: "Outdoor Spaces" },
      { icon: "📺", name: "Common TV Lounges" },
      { icon: "💊", name: "Medication Assistance" },
      { icon: "🎵", name: "Entertainment Programs" },
      { icon: "🐾", name: "Pet-Friendly" },
      { icon: "👨‍👩‍👧", name: "Family Visiting Areas" },
    ],
  },
  6: {
    id: 6,
    slug: "brookline-premier-assisted-living",
    name: "Brookline Premier Assisted Living",
    address: "987 Beacon St, Brookline, MA 02446",
    phone: "(617) 555-0606",
    email: "admissions@brooklinepremier.example.com",
    rating: 4.8,
    complianceRating: "Excellent",
    crimeRating: { facility: "Very Low", community: "Low" },
    culturalAffinity: ["Russian-speaking staff"],
    careTypes: ["Assisted Living", "Memory Care"],
    capacity: 95,
    monthlyMin: 5500,
    monthlyMax: 9000,
    about:
      "Brookline Premier Assisted Living offers luxury senior care in one of Boston's most prestigious neighborhoods. Our boutique community combines five-star amenities with personalized, compassionate care - redefining what assisted living can be.",
    complianceHistory: [
      { date: "Mar 2024", type: "Annual Inspection", findings: "No deficiencies found", status: "Pass" },
      { date: "Mar 2023", type: "Annual Inspection", findings: "No deficiencies found", status: "Pass" },
      { date: "Mar 2022", type: "Annual Inspection", findings: "No deficiencies found", status: "Pass" },
      { date: "Sep 2021", type: "Complaint Investigation", findings: "Unsubstantiated", status: "Resolved" },
      { date: "Mar 2021", type: "Annual Inspection", findings: "No deficiencies found", status: "Pass" },
    ],
    amenities: [
      { icon: "🍽️", name: "Fine Dining Restaurant" },
      { icon: "🍷", name: "Wine & Cocktail Lounge" },
      { icon: "🏋️", name: "Luxury Fitness Center" },
      { icon: "🧘", name: "Yoga & Meditation Studio" },
      { icon: "💆", name: "Spa & Wellness Center" },
      { icon: "🚌", name: "Concierge Transportation" },
      { icon: "💻", name: "Technology Programs" },
      { icon: "🎨", name: "Fine Arts Studio" },
      { icon: "🌳", name: "Rooftop Garden Terrace" },
      { icon: "💈", name: "Full-Service Salon & Spa" },
      { icon: "🎭", name: "Cultural Events & Theater" },
      { icon: "🏥", name: "On-Call Physician" },
    ],
  },
};

function slugify(input) {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function getTownFromAddress(address = "") {
  const addressParts = address.split(",");
  const town = addressParts[1] ? addressParts[1].trim() : "";
  return slugify(town);
}

export const MASSACHUSETTS_FACILITIES = Object.values(facilitiesData).map((facility) => ({
  ...facility,
  town: getTownFromAddress(facility.address),
}));

export const MASSACHUSETTS_FACILITIES_BY_SLUG =
  MASSACHUSETTS_FACILITIES.reduce((acc, facility) => {
    acc[facility.slug] = facility;
    return acc;
  }, {});

export const MASSACHUSETTS_FACILITIES_BY_TOWN_AND_SLUG =
  MASSACHUSETTS_FACILITIES.reduce((acc, facility) => {
    const key = `${facility.town}/${facility.slug}`;
    acc[key] = facility;
    return acc;
  }, {});
