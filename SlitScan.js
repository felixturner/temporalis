SlitScan = function () {

	var me = this;
	this.slices = 60;
	this.quality = 7;
	this.mode = 'vertical';
	this.throttle = false; //throttle draw FPS to 30
	this.smoothing = true;

	var lastDrawTime = 0;
	var camera, scene, renderer;
	var videoTexture,planeMaterial;
	var composer;
	var renderPass, copyPass;
	var plane;
	var uniforms;
	var imgTexture1;
	var imgTexture2;
	var renderSize = new THREE.Vector2(800,600);

	var video = document.createElement('video'),
		
		canvas = document.createElement('canvas'),
		ctx = canvas.getContext('2d'),
		
		canvas2 = document.createElement('canvas'),
		ctx2 = canvas2.getContext('2d'),

		bufferCanvas = document.createElement('canvas'),
		buffCtx = bufferCanvas.getContext('2d'),

		frames = [];

	me.init = function(){

		document.body.appendChild(video);
		document.body.appendChild(canvas);

		canvas.id = 'slit-scan';
		bufferCanvas.id = 'buffer';
		canvas.style.display = 'none';

		//INIT THREEJS
		camera = new THREE.PerspectiveCamera(75, 1080/ 720, 1, 3000);
		camera.position.z = 65;
		scene = new THREE.Scene();

		imgTexture = new THREE.Texture( canvas );
		imgTexture.minFilter = THREE.LinearFilter;
		imgTexture.magFilter = THREE.LinearFilter;

		imgTexture2 = new THREE.Texture( canvas2 );
		imgTexture2.minFilter = THREE.LinearFilter;
		imgTexture2.magFilter = THREE.LinearFilter;

		uniforms = {
			texture1: { type: "t", value: imgTexture },
			texture2: { type: "t", value: imgTexture2},
			slices:   { type: "f", value: 60},
			smoothing:   { type: "i", value: 1},
			direction:   { type: "i", value: 0}
		};

		planeMaterial = new THREE.ShaderMaterial( {

			uniforms: uniforms,
			vertexShader: document.getElementById( 'vertexShader' ).textContent,
			fragmentShader: document.getElementById( 'fragmentShader' ).textContent

		} );

		//Add image plane
		var planeGeometry = new THREE.PlaneBufferGeometry( 100,100,1,1 );
		plane = new THREE.Mesh( planeGeometry, planeMaterial );
		scene.add( plane );
		//init renderer
		renderer = new THREE.WebGLRenderer({
			preserveDrawingBuffer: true 
		});
		renderer.setSize( 800, 600 );
		renderer.setClearColor(0xFF0000);
		document.body.appendChild(renderer.domElement);
		renderer.domElement.style.position = 'absolute';
		renderer.domElement.style.display = 'none';

		//add stats
		stats = new Stats();
		document.body.appendChild(stats.domElement);
		stats.domElement.id = "stats";
		stats.domElement.style.position = 'absolute';
		stats.domElement.style.top = '0';
		stats.domElement.style.left = '0';

		video.addEventListener('play', update);
		window.addEventListener('resize', resize);

		//get webcam
		navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia || navigator.msGetUserMedia;
		navigator.getUserMedia({
			video: {
				//most webcam capture at max 30 fps
				//mandatory: {
				//minFrameRate: 31
				//},
				optional: [
					//request hi-rez capture
					{ minWidth: 1280 },
					{ minHeight: 720 },
					{ minFrameRate: 60 }
				]
			},
			audio: false
		}, function (localMediaStream) {
			video.addEventListener('loadedmetadata', onCamReady);
			video.src = window.URL.createObjectURL(localMediaStream);
		}, function (e) {
			console.log( e);
		});

	};

	var resize = function(){
		video.style.display = 'block';
		var scale = 0.1;//Math.min(window.innerWidth / video.offsetWidth, window.innerHeight / video.offsetHeight);
		
		canvas.style.width = video.offsetWidth * scale + 'px';
		canvas.style.height = video.offsetHeight * scale + 'px';
		canvas.style.left = '100px';//window.innerWidth * 0.5 - video.offsetWidth * scale * 0.5 + 'px';
		canvas.style.top = 0;//window.innerHeight * 0.5 - video.offsetHeight * scale * 0.5 + 'px';
		//canvas is same size as incoming video
		canvas.width = video.videoWidth || 1;
		canvas.height = video.videoHeight || 1;

		canvas2.width = video.videoWidth || 1;
		canvas2.height = video.videoHeight || 1;

		bufferCanvas.width = canvas.width;
		bufferCanvas.height = canvas.height;
		video.style.display = 'none';

		//resize threejs - size to fit VP and maintain source aspect ratio

		var vpSize = new THREE.Vector2(window.innerWidth,window.innerHeight);
		var vpAspect = vpSize.x/vpSize.y;

		var sourceAspect = video.videoWidth/video.videoHeight;




		if (sourceAspect > vpAspect){
			renderSize.x = vpSize.x;
			renderSize.y = vpSize.x / sourceAspect;
		}else{
			renderSize.y = vpSize.y;
			renderSize.x = vpSize.y * sourceAspect;
		}

		//center renderer inside Viewport
		renderer.domElement.style.left = Math.floor((vpSize.x - renderSize.x)/2) + 'px';
		renderer.domElement.style.top = Math.floor((vpSize.y - renderSize.y)/2) + 'px';

		renderSize.x = Math.round(renderSize.x);
		renderSize.y = Math.round(renderSize.y);


		console.log('source size: ', video.videoWidth, video.videoHeight);
		console.log('rendersize: ', renderSize.x, renderSize.y);

		if (renderSize.x > 0){
			camera.aspect = renderSize.x / renderSize.y;
			camera.updateProjectionMatrix();
			renderer.setSize( renderSize.x,renderSize.y);
			if (composer) composer.setSize(renderSize.x,renderSize.y );
		}

		//resize img plane fit viewport
		plane.scale.x = camera.aspect;
	};

	var onCamReady = function(){

		me.updateUniforms();
		video.play();
		renderer.domElement.style.display = 'block';
		resize();
	};

	var update = function(){

		if (me.throttle){
			//throttle to 30 FPS, since on 2014 MacBook Pro, webcam captures at 30fps max.
			if (Date.now() - lastDrawTime >= 1000 / 30) {
				draw();
				lastDrawTime = Date.now();
			}
		}else{
			draw();
		}

		renderer.render( scene, camera);
		stats.update();
		requestAnimationFrame(update);

	};

	var draw = function () {

		if (video.paused) return;
		if(me.mode === 'vertical'){
			drawVert();
		}else{
			drawHorz();
		}
		while (frames.length > me.slices){
			frames.shift();
		}

		if ( video && video.readyState === video.HAVE_ENOUGH_DATA ) {
			
			imgTexture.needsUpdate = true;
			imgTexture2.needsUpdate = true;
		}

	};

	function drawVert() {

		var sliceHeight = canvas.height / me.slices;

		// save current frame to array
		buffCtx.drawImage(video, 0, 0);
		frames.push(buffCtx.getImageData(0, 0, bufferCanvas.width, bufferCanvas.height));

		//draw slices to canvas
		for (var i = 0; i < me.slices; i++) {
			try {
				ctx.putImageData(frames[i], 0, 0 , 0, sliceHeight * i , bufferCanvas.width, sliceHeight);
			} catch (e) {
			}
		}

		//draw previous slices to canvas2
		for ( i = 1; i < me.slices; i++) {
			try {
				ctx2.putImageData(frames[i - 1], 0, 0 , 0, sliceHeight * i  , bufferCanvas.width, sliceHeight);
			} catch (e) {
			}
		}

	}

	function drawHorz() {

		var sliceWidth = canvas.width / me.slices;

		// save current frame to array
		buffCtx.drawImage(video, 0, 0);
		frames.push(buffCtx.getImageData(0, 0, bufferCanvas.width, bufferCanvas.height));

		//draw slices to canvas
		for (var i = 0; i < me.slices; i++) {
			try {
				ctx.putImageData(frames[i], 0, 0 ,  sliceWidth * i , 0, sliceWidth, bufferCanvas.height );
			} catch (e) {
			}
		}

		//draw previous slices to canvas2
		for ( i = 1; i < me.slices ; i++) {
			try {
				ctx2.putImageData(frames[i - 1], 0, 0 ,  sliceWidth * i , 0, sliceWidth, bufferCanvas.height );
			} catch (e) {
			}
		}
		
	}

	me.saveImage = function() {

		var imgData = renderer.domElement.toDataURL("image/jpeg");    

		if (navigator.userAgent.toLowerCase().indexOf('chrome') > -1){
			
			var now = new Date();
			var stamp = now.getFullYear() + "-" + now.getMonth() + "-" + now.getDate() + "_" + now.getHours() + "." + now.getMinutes() + "." + now.getSeconds();
			
			var a = document.createElement('a');
			a.href = imgData;
			a.download = "temporalis_" + stamp + ".jpg";
			a.click();


		}else{
			window.open(imgData);
		}

	};

	me.updateUniforms = function(val){
		uniforms.smoothing.value = me.smoothing ? 1 : 0;
		uniforms.direction.value = me.mode === 'vertical' ? 0 : 1;
		uniforms.slices.value = me.slices;
	};

};