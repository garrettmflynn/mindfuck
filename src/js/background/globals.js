
export const allVisits = {}

// Get the correct ID to account for refreshes
export const getId = (id, offset) => {
    let i = 0
    let returned = id
  
    // Only return a visit that doesn't exist or is not closed
    while (allVisits[returned] && allVisits[returned]?.ended != null) {
      i++
      returned = `${id}+${i}` // Iterate ID
    }

    if (offset) returned = `${id}+${i + offset}` // Return offset id
  
    return returned
  }