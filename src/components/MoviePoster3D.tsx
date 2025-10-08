
import { useEffect, useRef } from "react";
import * as THREE from "three";

interface MoviePoster3DProps {
  image: string;
}

export const MoviePoster3D = ({ image }: MoviePoster3DProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mousePosition = useRef({ x: 0, y: 0 });

  useEffect(() => {
    if (!containerRef.current) return;

    // Scene setup
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, containerRef.current.clientWidth / containerRef.current.clientHeight, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    
    renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
    containerRef.current.appendChild(renderer.domElement);

    // Create poster plane
    const geometry = new THREE.PlaneGeometry(5, 7);
    const textureLoader = new THREE.TextureLoader();
    const texture = textureLoader.load(image);
    const material = new THREE.MeshBasicMaterial({ map: texture });
    const poster = new THREE.Mesh(geometry, material);
    scene.add(poster);

    // Position camera
    camera.position.z = 7;

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(5, 5, 5);
    scene.add(directionalLight);

    // Mouse movement handler
    const handleMouseMove = (event: MouseEvent) => {
      mousePosition.current = {
        x: (event.clientX / window.innerWidth) * 2 - 1,
        y: -(event.clientY / window.innerHeight) * 2 + 1
      };
    };

    window.addEventListener('mousemove', handleMouseMove);

    // Animation loop
    const animate = () => {
      requestAnimationFrame(animate);

      // Smooth poster rotation based on mouse position
      poster.rotation.y = THREE.MathUtils.lerp(poster.rotation.y, mousePosition.current.x * 0.2, 0.1);
      poster.rotation.x = THREE.MathUtils.lerp(poster.rotation.x, mousePosition.current.y * 0.2, 0.1);

      renderer.render(scene, camera);
    };

    animate();

    // Cleanup
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      containerRef.current?.removeChild(renderer.domElement);
      renderer.dispose();
    };
  }, [image]);

  return <div ref={containerRef} className="w-full h-full" />;
};
