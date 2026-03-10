export const calculateRoute = (
  directionsService: google.maps.DirectionsService,
  origin: google.maps.LatLngLiteral,
  destination: google.maps.LatLngLiteral,
  waypoints?: google.maps.DirectionsWaypoint[]
): Promise<google.maps.DirectionsResult> => {
  return new Promise((resolve, reject) => {
    directionsService.route(
      {
        origin,
        destination,
        waypoints,
        travelMode: google.maps.TravelMode.DRIVING
      },
      (result, status) => {
        if (status === google.maps.DirectionsStatus.OK && result) {
          resolve(result);
        } else {
          reject(status);
        }
      }
    );
  });
};
