import * as THREE from 'three';

// ===== USTAWIENIA — wszystko, co warto zmieniać, jest tutaj =====

// Ile pikseli ma 1 cm na Twoim ekranie (szerokość ekranu w px / szerokość w cm).
const PX_PER_CM = 37.8;

const EYE_DISTANCE = 60; // odległość oka od ekranu [cm]
const PHOTO_DEPTH = 20; // jak daleko za ekranem stoi tył zdjęcia (ściana) [cm]
const RELIEF = 15; // o ile cm mapa głębi wypycha do przodu najbliższe miejsca (białe)

// O ile cm może się przesunąć oko (mysz na krawędzi ekranu = maksymalne wychylenie).
const MOVE_X = 15;
const MOVE_Y = 10;

let brightness = 1.0; // oświetlenie: zmieniaj klawiszami + i -
// 1.0 = oryginalne kolory zdjęcia

// ================================================================

const canvas = document.getElementById('view');

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(devicePixelRatio);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera();

// Równe światło z każdej strony. Natężenie π daje dokładnie oryginalne kolory zdjęcia.
const light = new THREE.AmbientLight('white', Math.PI);
scene.add(light);

// Oko obserwatora w cm. Środek ekranu to (0, 0, 0), ekran leży w płaszczyźnie z = 0.
const eye = new THREE.Vector3(0, 0, EYE_DISTANCE);
const target = eye.clone();

let photo; // płaszczyzna ze zdjęciem
let aspect; // szerokość / wysokość zdjęcia
let winW, winH; // rozmiar okna = cały ekran [cm]

new THREE.TextureLoader().load('/mug.png', (texture) => {
  texture.colorSpace = THREE.SRGBColorSpace;
  aspect = texture.image.width / texture.image.height;

  // Płaszczyzna 1 × 1 podzielona na siatkę 256 × 192 punktów, żeby dało się ją wygiąć.
  // Prawdziwy rozmiar nadajemy przez scale w resize().
  // displacementMap: każdy punkt siatki jest wypychany do przodu o (jasność mapy głębi) · RELIEF cm.
  photo = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1, 256, 192),
    new THREE.MeshLambertMaterial({
      map: texture,
      displacementMap: new THREE.TextureLoader().load('/depth.png'),
      displacementScale: RELIEF,
    }),
  );
  photo.position.z = -PHOTO_DEPTH;
  scene.add(photo);

  resize();
  requestAnimationFrame(frame);
});

// Okno = całe okno przeglądarki. Zdjęcie dobieramy tak, żeby zawsze zakrywało ekran.
function resize() {
  renderer.setSize(innerWidth, innerHeight);
  winW = innerWidth / PX_PER_CM;
  winH = innerHeight / PX_PER_CM;

  // Patrząc prosto, zdjęcie widać na ekranie pomniejszone o k = EYE / (EYE + DEPTH).
  // Przy ruchu głowy o MOVE cm zdjęcie przesuwa się o MOVE · DEPTH / (EYE + DEPTH).
  // Zdjęcie musi więc pokryć ekran plus ten zapas z każdej strony (jak CSS „cover”).
  const k = EYE_DISTANCE / (EYE_DISTANCE + PHOTO_DEPTH);
  const shift = PHOTO_DEPTH / (EYE_DISTANCE + PHOTO_DEPTH);
  const needW = (winW + 2 * MOVE_X * shift) / k;
  const needH = (winH + 2 * MOVE_Y * shift) / k;
  const photoH = Math.max(needH, needW / aspect);
  photo.scale.set(photoH * aspect, photoH, 1);
}
window.addEventListener('resize', resize);

// Projekcja off-axis: kamera stoi w miejscu oka, a jej ostrosłup widzenia
// przechodzi dokładnie przez krawędzie ekranu (nawet gdy oko nie jest na środku).
function updateCamera() {
  const near = 1;
  const s = near / eye.z;
  camera.position.copy(eye);
  camera.projectionMatrix.makePerspective(
    (-winW / 2 - eye.x) * s, // lewo
    (winW / 2 - eye.x) * s, // prawo
    (winH / 2 - eye.y) * s, // góra
    (-winH / 2 - eye.y) * s, // dół
    near,
    1000,
  );
  camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
}

// Mysz udaje ruch głowy (w następnym etapie zastąpi ją kamerka).
window.addEventListener('mousemove', (e) => {
  target.x = ((e.clientX / innerWidth) * 2 - 1) * MOVE_X;
  target.y = -((e.clientY / innerHeight) * 2 - 1) * MOVE_Y;
});

window.addEventListener('keydown', (e) => {
  if (e.key === '+' || e.key === '=') brightness = Math.min(2, brightness + 0.05);
  if (e.key === '-') brightness = Math.max(0, brightness - 0.05);
  if (e.key === 'f') document.documentElement.requestFullscreen();
  if (e.key === 'w') photo.material.wireframe = !photo.material.wireframe; // pokaż siatkę
});

function frame() {
  eye.lerp(target, 0.1); // płynny ruch
  light.intensity = Math.PI * brightness;
  updateCamera();
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
