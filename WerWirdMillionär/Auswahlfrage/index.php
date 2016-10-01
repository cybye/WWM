<?
	session_start();

        include "funcs.php";
        $mysql = sql_init();

	$secretmethod = "AES-256-CBC";
	$secrethash = "25c6c7ff35b9979b151f2136cd13b0e0";
	$penalty = 900;
	if ( isset($_SESSION['data'])) {
		@$decrypted = json_decode(openssl_decrypt($_SESSION['data'], $secretmethod, $secrethash));
		$nexttry = $decrypted->lastquestion - date("U") + $penalty;
		if ( $nexttry < 1 ) {
			session_destroy();
			header("Location: " . $_SERVER['PHP_SELF']);
			die();
		}
	}
	html_head();
	javascript();
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
			$dbentrycreated = false;
			$time = date("U");
			while ( $dbentrycreated == false ) {
				$id = strtoupper(base_convert($time, 10, 36));
				$query  = "SELECT * FROM games WHERE id = \"$id\"";
				$result = mysql_query($query,$mysql);
				if ( mysql_num_rows($result)) {
					$time++;
				} else {
					$query  = "INSERT INTO games (id, name, mistakes, completed, total, starttime, endtime) VALUES (\"$id\", \"$name\", 0, 0, 0, NOW(), NULL)";
					$result = mysql_query($query,$mysql);
					$dbentrycreated = true;
				}
			}
			$secret = "e405eab841f951976a630c26d9d74d2fe567c8bc";

			$url = "https://cybye.de/wwm/api/v1/create?secret=$secret&id=$id&name=" . urlencode($name);
			$result = file_get_contents($url);
			if ( $result == "created" ) {
				echo "<P>RICHTIG!</P>";
				echo "<P>Dein Spielcode ist: </p>\n";
				echo "<p style=\"font-size: 30px;\"><b>$id</b></P>\n";
				echo "<P>Gehe nun zu den Listing-Koordinaten und suche dort nach einem QR-Code, der das Spiel startet!</P>";
			        $info = $_SERVER['REMOTE_ADDR'];
			        $info .= "\n";
			        $info .= gethostbyaddr($_SERVER['REMOTE_ADDR']);
			        $info .= "\n";
			        $info .= $_SERVER['HTTP_USER_AGENT'];
			        $info .= "\n";
			        $info .= date("Y-m-d H:i:s");
				@mail("geochecker@jachmann.de", "$name beginnt neues Spiel!", $info);
			}
			session_destroy();
		} else {
			echo "<P>Das war leider falsch!</P><P>Zeit bis zum n&auml;chsten Versuch: </P>";
			$nexttry = $decrypted->lastquestion - date("U") + $penalty;
			echo "<P><b id=\"cID3\">   Init<script>countdown($nexttry,'cID3','answer');</script></b></P>\n";

		}
	} elseif ( strlen($name) ) {
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
		echo "<P>Hallo $name</P>\n";
		echo "<P><B>$question</B></P>\n";
		echo "<P><b id=\"cID3\">   Init<script>countdown($time,'cID3','question');</script></b></P><P>\n";
		foreach ( $set as $k => $v ) {
			echo "<input style=\"width: 80px; height: 50px; padding: 10px; margin: 10px;\" class=\"greenbutton\" id =\"$counter\" type=\"button\" value=\"$v\" onClick=\"doit(this)\">\n"; 
			$order .= $k;
			$counter++;
			$values .= $v;
		}	
		echo "</P><P><input style=\"width: 380px; height: 50px;\" id=\"submit\" type=\"submit\" value=\"GO\" disabled></P>\n";
		echo "<input id=\"answer\" name=\"answer\" type=\"hidden\" value=\"\">\n";
		echo "<input id=\"name\" name=\"name\" type=\"hidden\" value=\"$name\">\n";
		echo "</form>\n";
		$data['expectedorder'] = $order;
		$data['values'] = $values;
		$data['lastquestion'] = date("U");
		@$secretdata = openssl_encrypt(json_encode($data), $secretmethod, $secrethash);
		$_SESSION['data'] = $secretdata;
	} else {
		echo "<p>Bitte gib hier deinen GC-Namen oder einen anderen Namen f&uuml;r dich oder deine Gruppe an!</P>\n";
		echo "<form method=\"get\" action=\"" . $_SERVER['PHP_SELF']. "\">";
		echo "<input style=\"height: 50px; font-size: 30px;\" type=\"text\" name=\"name\">\n";
		echo "<input style=\"height: 50px; font-size: 30px;\" d=\"submit\" type=\"submit\" value=\"GO\">\n";
		echo "</form>\n";
		echo "<p>Mit diesem Namen werdet Ihr w&auml;hrend des Spiels identifiziert.</p>\n";
		echo "<p>Nach dem &quot;GO&quot; geht es sofort mit der Auswahlfrage weiter. Der Countdown beginnt sofort.<br> Also\n";
		echo "sei bereit! Nach einer falschen Antwort musst Du eine Weile warten bis Du einen neuen Versuch starten darfst.\n";

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
		echo "<meta http-equiv=\"content-type\" content=\"text/html; charset=utf-8\">\n";
		echo "<title>Wer wird GC-Million&auml;r - Auswahlfrage</title>\n";
		echo "<script language=\"JavaScript\" src=\"auswahlfrage.js\"></script>\n";
		echo "<link rel=\"stylesheet\" href=\"auswahlfrage.css\">\n";
		echo "</head>\n";
		echo "<body>\n";
		echo "<div style=\"text-align: center;\">\n";
		echo "<img src=\"logo.gif\">\n";
		echo "</div>\n";
		echo "<div style=\"text-align: center;\">\n";
	}
	
	function html_foot () {
		echo "</div>\n";
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


