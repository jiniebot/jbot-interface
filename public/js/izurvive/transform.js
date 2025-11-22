const earthRadius = 6378137;
const MAX_LATITUDE = 85.0511287798;

class Point {
    constructor(x, y) {
        this.x = x;
        this.y = y;
    }
}

class Coordinate {
    constructor(lat, lng) {
        this.lat = lat;
        this.lng = lng;
    }
}

class Bounds {
    constructor(p1, p2) {
        this.p1 = p1;
        this.p2 = p2;
    }

    get size() {
        return new Size(this.maxX - this.minX, this.maxY - this.minY);
    }

    get minX() {
        return Math.min(this.p1[0], this.p2[0]);
    }

    get maxX() {
        return Math.max(this.p1[0], this.p2[0]);
    }

    get minY() {
        return Math.min(this.p1[1], this.p2[1]);
    }

    get maxY() {
        return Math.max(this.p1[1], this.p2[1]);
    }
}

class Size {
    constructor(width, height) {
        this.width = width;
        this.height = height;
    }
}

class LinearTransform {
    constructor(kx, ky, dx, dy) {
        this.kx = kx;
        this.ky = ky;
        this.dx = dx;
        this.dy = dy;
    }

    static fromSize(size, coverage) {
        const projectionBounds = SphericalMercator.bounds;
        const kx = size.width / (projectionBounds.size.width * coverage);
        const ky = size.height / (projectionBounds.size.height * coverage);

        return new LinearTransform(kx, ky, -1.0 * projectionBounds.minX * kx, -1.0 * projectionBounds.minY * ky);
    }

    transform(point) {
        return new Point(point.x * this.kx + this.dx, point.y * this.ky + this.dy);
    }

    reverse(point) {
        return new Point((point.x - this.dx) / this.kx, (point.y - this.dy) / this.ky);
    }
}

class SphericalMercator {
    static project(coordinate) {
        const d = Math.PI / 180;
        const max = MAX_LATITUDE;
        const lat = Math.max(Math.min(max, coordinate.lat), -max);
        const sin = Math.sin(lat * d);

        return new Point(earthRadius * coordinate.lng * d, earthRadius * Math.log((1 + sin) / (1 - sin)) / 2);
    }

    static unproject(point) {
        const d = 180 / Math.PI;

        return new Coordinate((2 * Math.atan(Math.exp(point.y / earthRadius)) - Math.PI / 2) * d, (point.x * d) / earthRadius);
    }

    static get bounds() {
        const d = earthRadius * Math.PI;
        return new Bounds([-d, -d], [d, d]);
    }
}

export { Point, Coordinate, Bounds, Size, LinearTransform, SphericalMercator };
