
from shapely.geometry import Point, Polygon


# A fictional rectangular geographic area.
flood_zone = Polygon([
    (90.3500, 23.7300),
    (90.4000, 23.7300),
    (90.4000, 23.7800),
    (90.3500, 23.7800),
    (90.3500, 23.7300)
])


# Location inside the polygon.
dhanmondi = Point(90.3760, 23.7465)

# Location outside the polygon.
outside_location = Point(90.4500, 23.8000)

# Location exactly on the polygon boundary.
boundary_location = Point(90.3500, 23.7500)


print("Dhanmondi:")
print("Contains:", flood_zone.contains(dhanmondi))
print("Covers:", flood_zone.covers(dhanmondi))

print("\nOutside location:")
print("Contains:", flood_zone.contains(outside_location))
print("Covers:", flood_zone.covers(outside_location))

print("\nBoundary location:")
print("Contains:", flood_zone.contains(boundary_location))
print("Covers:", flood_zone.covers(boundary_location))
