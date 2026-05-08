// // Calculate distance between two coordinates using Haversine formula
// function calculateDistance(lat1, lon1, lat2, lon2) {
//   const R = 6371; // Earth's radius in kilometers
//   const dLat = toRadians(lat2 - lat1);
//   const dLon = toRadians(lon2 - lon1);
  
//   const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
//     Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
//     Math.sin(dLon / 2) * Math.sin(dLon / 2);
  
//   const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
//   const distance = R * c; // Distance in kilometers
  
//   return Math.round(distance * 100) / 100; // Round to 2 decimal places
// }

// function toRadians(degrees) {
//   return degrees * (Math.PI / 180);
// }

// // Calculate fare based on distance (₹20 per 10km)
// function calculateFare(distance) {
//   if (distance <= 0) return 0;
  
//   // Minimum fare for first 10km
//   let fare = 20;
  
//   // Additional fare for distance beyond 10km
//   if (distance > 10) {
//     const additionalDistance = distance - 10;
//     const additional10kmUnits = Math.ceil(additionalDistance / 10);
//     fare += additional10kmUnits * 20;
//   }
  
//   return fare;
// }

// // Main function to calculate fare between two stops
// function calculateFareBetweenStops(sourceStop, destinationStop) {
//   console.log("🔍 DEBUG: Calculating fare between stops:", {
//     source: sourceStop?.name,
//     destination: destinationStop?.name,
//     sourceCoords: sourceStop?.coordinates,
//     destCoords: destinationStop?.coordinates,
//     sourceStopId: sourceStop?._id,
//     destStopId: destinationStop?._id
//   });
  
//   // Check if coordinates are available
//   if (!sourceStop?.coordinates || !destinationStop?.coordinates) {
//     console.log("🔍 DEBUG: Missing coordinates, using fallback fare calculation");
    
//     // Fallback: Use a dynamic fare based on stop IDs and names
//     let fallbackFare = 20; // Default minimum fare
    
//     // Create a hash from stop IDs for consistent but varied fares
//     if (sourceStop?._id && destinationStop?._id) {
//       const sourceId = sourceStop._id.toString();
//       const destId = destinationStop._id.toString();
      
//       // Create a numeric hash from the stop IDs
//       const idHash = (sourceId.charCodeAt(0) + destId.charCodeAt(0)) % 100;
      
//       // Base fare varies from 20 to 80 based on route
//       fallbackFare = 20 + (idHash % 60);
      
//       // Adjust based on stop names for more realistic variation
//       if (sourceStop?.name && destinationStop?.name) {
//         const sourceName = sourceStop.name.toLowerCase();
//         const destName = destinationStop.name.toLowerCase();
        
//         // Route type adjustments
//         if (sourceName.includes('airport') || destName.includes('airport')) {
//           fallbackFare += 50; // Airport routes are expensive
//         } else if (sourceName.includes('station') || destName.includes('station')) {
//           fallbackFare += 20; // Station routes
//         } else if (sourceName.includes('bus') || destName.includes('bus')) {
//           fallbackFare += 10; // Bus stand routes
//         }
        
//         // Distance simulation based on name length difference
//         const nameDiff = Math.abs(sourceName.length - destName.length);
//         fallbackFare += nameDiff * 2; // Longer names = further apart
        
//         // Ensure minimum fare
//         if (fallbackFare < 20) fallbackFare = 20;
        
//         // Cap maximum fare for city routes
//         if (fallbackFare > 150) fallbackFare = 150;
//       }
//     }
    
//     console.log("🔍 DEBUG: Using fallback fare:", fallbackFare);
//     return {
//       distance: 0,
//       fare: fallbackFare,
//       error: "Using fallback fare (coordinates not available)"
//     };
//   }
  
//   const { lat: lat1, lng: lon1 } = sourceStop.coordinates;
//   const { lat: lat2, lng: lon2 } = destinationStop.coordinates;
  
//   // Calculate distance
//   const distance = calculateDistance(lat1, lon1, lat2, lon2);
  
//   // Calculate fare
//   const fare = calculateFare(distance);
  
//   console.log("🔍 DEBUG: Fare calculation result:", {
//     distance: `${distance} km`,
//     fare: `₹${fare}`,
//     sourceCoords: `${lat1}, ${lon1}`,
//     destCoords: `${lat2}, ${lon2}`
//   });
  
//   return {
//     distance,
//     fare,
//     error: null
//   };
// }

// module.exports = {
//   calculateDistance,
//   calculateFare,
//   calculateFareBetweenStops
// };


// utils/fareCalculator.js
// Calculate distance between two coordinates using Haversine formula
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in kilometers
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  
  return Math.round(distance * 100) / 100;
}

function toRadians(degrees) {
  return degrees * (Math.PI / 180);
}

// Calculate fare based on distance (₹20 per 10km)
function calculateFare(distance) {
  if (distance <= 0) return 20;
  
  // ₹20 for every 10km or part thereof
  const tenKmUnits = Math.ceil(distance / 10);
  const fare = tenKmUnits * 20;
  
  return fare;
}

// Main function to calculate fare between two stops
function calculateFareBetweenStops(sourceStop, destinationStop) {
  // Check if coordinates are available
  if (!sourceStop || !destinationStop) {
    return {
      distance: 0,
      fare: 20,
      error: "Stop data missing"
    };
  }
  
  const lat1 = sourceStop.latitude;
  const lon1 = sourceStop.longitude;
  const lat2 = destinationStop.latitude;
  const lon2 = destinationStop.longitude;
  
  // Check if coordinates are valid
  if (!lat1 || !lon1 || !lat2 || !lon2) {
    return {
      distance: 0,
      fare: 20,
      error: "Coordinates not available"
    };
  }
  
  // Calculate actual distance
  const distance = calculateDistance(lat1, lon1, lat2, lon2);
  
  // Calculate fare based on distance
  const fare = calculateFare(distance);
  
  return {
    distance: distance,
    fare: fare,
    error: null
  };
}

module.exports = {
  calculateDistance,
  calculateFare,
  calculateFareBetweenStops
};