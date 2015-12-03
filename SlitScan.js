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

	var texArray;

	var imgTexture1;
	var imgTexture2;

	var video = document.createElement('video'),
		
		canvas = document.createElement('canvas'),
		ctx = canvas.getContext('2d'),
		
		canvas2 = document.createElement('canvas'),
		ctx2 = canvas2.getContext('2d'),

		bufferCanvas = document.createElement('canvas'),
		buffCtx = bufferCanvas.getContext('2d'),

		

		frames = [];

	[video, canvas].forEach(function(el){
		document.body.appendChild(el);
	});

	canvas.id = 'slit-scan';
	bufferCanvas.id = 'buffer';

	//INIT THREEJS
	camera = new THREE.PerspectiveCamera(75, 1080/ 720, 1, 3000);
	//good distance to fit a 100 x 100 plane in Viewport
	camera.position.z = 65;
	//camera.position.z = 68; //give some room around image for glitch effects
	scene = new THREE.Scene();
	//image
	//need to init with an image map or video texture will crap out
	//imgTexture = THREE.ImageUtils.loadTexture( "badge.png" );
	

	// planeMaterial = new THREE.MeshBasicMaterial( {
	// 	map: imgTexture,
	// 	//wireframe:true,
	// 	//color: 0xFF00FF
	// } );

	imgTexture = new THREE.Texture( canvas );
	imgTexture.minFilter = THREE.LinearFilter;
	imgTexture.magFilter = THREE.LinearFilter;

	imgTexture2 = new THREE.Texture( canvas2 );
	imgTexture2.minFilter = THREE.LinearFilter;
	imgTexture2.magFilter = THREE.LinearFilter;

	// texArray = [];
	// for (var i = 0; i < me.slices; i++) {
	// 	var tex = new THREE.Texture( canvas );
	// 	tex.minFilter = THREE.LinearFilter;
	// 	tex.magFilter = THREE.LinearFilter;
	// 	texArray.push(tex);
	// }

	uniforms = {

		texture1: { type: "t", value: imgTexture },
		texture2: { type: "t", value: imgTexture2},
		slices:   { type: "f", value: 60},
		smoothing:   { type: "i", value: 1}

		//uTexArray : { type: "tv", value: texArray } // texture array (regular)
 
	};

	planeMaterial = new THREE.ShaderMaterial( {

		uniforms: uniforms,
		vertexShader: document.getElementById( 'vertexShader' ).textContent,
		fragmentShader: document.getElementById( 'fragmentShader' ).textContent

	} );


	//DEBUG
	//$("#webgl").css("display","block");
	//Add image plane
	var planeGeometry = new THREE.PlaneBufferGeometry( 1280/10, 720/10,1,1 );
	plane = new THREE.Mesh( planeGeometry, planeMaterial );
	scene.add( plane );
	//init renderer
	renderer = new THREE.WebGLRenderer({
		preserveDrawingBuffer: true 
	});
	renderer.setSize( 800, 600 );
	document.body.appendChild(renderer.domElement);
	renderer.setClearColor( 0x220000 );

	//post processing
	// renderPass = new THREE.RenderPass( scene, camera );
	// copyPass = new THREE.ShaderPass( THREE.CopyShader );
	// composer = new THREE.EffectComposer( renderer);
	// composer.addPass( renderPass );
	// composer.addPass( copyPass );
	// copyPass.renderToScreen = true;


	//add stats
	stats = new Stats();
	document.body.appendChild(stats.domElement);
	stats.domElement.id = "stats";
	stats.domElement.style.position = 'absolute';
	stats.domElement.style.top = '0';
	stats.domElement.style.left = '0';

	video.addEventListener('play', function () {
		update();
	});

	function onResize(){
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

		//resize threejs
		var renderSize = new THREE.Vector2(window.innerWidth,window.innerHeight);
		camera.aspect = renderSize.x / renderSize.y;
		camera.updateProjectionMatrix();
		renderer.setSize( renderSize.x,renderSize.y);
		//if (composer) composer.setSize(renderSize.x,renderSize.y );

	}
	this.resize = onResize;
	window.addEventListener('resize', onResize);

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
		video.addEventListener('loadedmetadata', function(){
			onResize();
		});
		video.src = window.URL.createObjectURL(localMediaStream);
		setTimeout(onCamEnabled, 500);
	}, function (e) {
		console.log( e);
	});

	var onCamEnabled = function(){


		console.log('ppp');

		video.play();

		//init video texture
		// videoTexture = new THREE.Texture( canvas );
		// videoTexture.minFilter = THREE.LinearFilter;
		// videoTexture.magFilter = THREE.LinearFilter;

		// planeMaterial.map = videoTexture;
		// planeMaterial.needsUpdate = true;


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

			//texArray[0].needsUpdate = true;
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
				
				//think these are both the same???

				//ctx2.putImageData(frames[i ], 0, 0 , 0, sliceHeight * (i - 1) , bufferCanvas.width, sliceHeight);


				ctx2.putImageData(frames[i - 1], 0, 0 , 0, sliceHeight * (i ) , bufferCanvas.width, sliceHeight);


			} catch (e) {
			}
		}

	}

	// function drawHorz() {

	// 	var sliceWidth = canvas.width / me.slices;

	// 	// save current frame to array
	// 	buffCtx.drawImage(video, 0, 0, video.videoWidth, video.videoHeight, 0, 0, bufferCanvas.width, bufferCanvas.height);
	// 	frames.push(buffCtx.getImageData(0, 0, bufferCanvas.width, bufferCanvas.height));

	// 	//draw slices to canvas
	// 	for (var i = 0; i < me.slices; i++) {
	// 		try {
	// 			ctx.putImageData(frames[i], 0, 0 ,  sliceWidth * i , 0, sliceWidth, bufferCanvas.height );
	// 		} catch (e) {
	// 		}
	// 	}
		
	// }

	//draw();

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

	me.updateSmoothing = function(val){

		uniforms.smoothing.value = val ?  1 :  0;


	};

};