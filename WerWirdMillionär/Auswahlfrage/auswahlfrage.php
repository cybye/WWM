<?
	session_start();
	$secretmethod = "AES-256-CBC";
	$secrethash = "25c6c7ff35b9979b151f2136cd13b0e0";
	html_head();
	if ( isset($_SESSION['data'])) {
		$counter = 0;
		@$decrypted = json_decode(openssl_decrypt($_SESSION['data'], $secretmethod, $secrethash));
		$solved = true;
		while ( $counter < strlen($decrypted->expectedorder)) {
			if ( ! ( $counter == substr($_GET['answer'], substr($decrypted->expectedorder, $counter,1), 1) ) ) {
				$solved = false;
			}
			$counter++;
		}
		if ( $solved ) {
			echo "RICHTIG!";
		} else {
			echo "<A HREF=\"" . $_SERVER['PHP_SELF'] . "\">FALSCH!</A>";
		}
		session_destroy();
	} else {
		javascript();
		echo "<form method=\"get\" action=\"" . $_SERVER['PHP_SELF']. "\">";

		$url = "https://docs.google.com/spreadsheets/d/1nbm5eiUVNfPoZ4_wSVZUfKP5_OnHF4Fs8b52ur9QxPc/pub?gid=992374186&single=true&output=csv";
		$csv = array();
		$data = array();
		$counter = 0;
		$order = "";
		$values = "";
		$lines = file($url);
		foreach ( $lines as $l ) {
			$csv[] = str_getcsv($l);
		}
		$rand = rand(0,sizeof($csv)-1);
		$data['rand'] = $rand;	
		$set = $csv[$rand];
		$question = array_shift($set);
		$time = (int) array_shift($set);
		$data['question'] = $question;
		$data['answers'] = $set;	
		shuffle_assoc($set);
		echo "<P><B>$question</B></P>\n";
		echo "<b id=\"cID3\">   Init<script>countdown($time,'cID3');</script></b><br>\n";
		foreach ( $set as $k => $v ) {
			echo "<input class=\"greenbutton\" id =\"$counter\" type=\"button\" value=\"$v\" onClick=\"doit(this)\">\n"; 
			$order .= $k;
			$counter++;
			$values .= $v;
		}	
		echo "<input id=\"submit\" type=\"submit\" value=\"GO\" disabled>\n";
		echo "<input id=\"answer\" name=\"answer\" type=\"hidden\" value=\"\">\n";
		echo "</form>\n";
		$data['expectedorder'] = $order;
		$data['values'] = $values;

		@$secretdata = openssl_encrypt(json_encode($data), $secretmethod, $secrethash);
		$_SESSION['data'] = $secretdata;
	}
	html_foot();
			
	// FUNCS
	
	function javascript () {
		echo "<script>";
		echo "	function doit(x) {\n";
		echo "		console.log(x.id);\n";
		echo "		document.getElementById('answer').value = document.getElementById('answer').value + x.id;\n";
		echo "		document.getElementById(x.id).disabled = true;\n";
		echo "		document.getElementById(x.id).className = \"redbutton\";\n";
		echo "		console.log(document.getElementById('answer').value.length);\n";
		echo "		if ( document.getElementById('answer').value.length == 4 ) {\n";
		echo "			document.getElementById('submit').disabled = false;\n";
		echo "			document.getElementById('submit').className = \"greensubmitbutton\";\n";
		echo "		}\n";
		echo "	}\n";
		echo "</script>\n";
	}

	function html_head() {
		echo "<html>\n";
		echo "<head>\n";
		echo "<title>WWM</title>\n";
		echo "<script language=\"JavaScript\" src=\"auswahlfrage.js\"></script>\n";
		echo "<link rel=\"stylesheet\" href=\"auswahlfrage.css\">\n";
		echo "</head>\n";
		echo "<body>\n";
	}
	
	function html_foot () {
		echo "</body>\n";
		echo "</html>\n";
	}

	function shuffle_assoc(&$array) {
	 	$keys = array_keys($array);
		shuffle($keys);
		foreach($keys as $key) {
			$new[$key] = $array[$key];
	        }
	        $array = $new;
	        return true;
	}


